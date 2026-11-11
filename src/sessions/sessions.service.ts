import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateSessionDto } from './dto/create-session.dto';
import { CreateSetDto } from './dto/create-set.dto';
import { UpdateSessionDto } from './dto/update-session.dto';
import { UpdateSetDto } from './dto/update-set.dto';

const isP2002 = (e: unknown) =>
  e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002';

@Injectable()
export class SessionsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(userId: string, dto: CreateSessionDto) {
    // UUID é o mesmo valor em qualquer caixa; grava e busca sempre em minúsculas.
    dto = { ...dto, id: dto.id.toLowerCase() };
    const existing = await this.prisma.workoutSession.findUnique({
      where: { id: dto.id },
    });
    if (existing) return this.reenvio(userId, existing);

    const routine = await this.prisma.workoutRoutine.findFirst({
      where: { id: dto.routineId, userId },
    });
    if (!routine) {
      throw new NotFoundException('Ficha de treino não encontrada');
    }

    const items = await this.prisma.routineItem.count({
      where: { routineId: dto.routineId },
    });
    if (items === 0) {
      throw new BadRequestException('Ficha de treino sem exercícios');
    }

    const open = await this.prisma.workoutSession.findFirst({
      where: { userId, finishedAt: null },
    });
    if (open) throw new ConflictException('Já existe uma sessão aberta');

    try {
      const session = await this.prisma.workoutSession.create({
        data: {
          id: dto.id,
          userId,
          routineId: dto.routineId,
          startedAt: new Date(dto.startedAt),
        },
      });
      return { created: true, session };
    } catch (e) {
      if (isP2002(e)) {
        const winner = await this.prisma.workoutSession.findUnique({
          where: { id: dto.id },
        });
        if (winner) return this.reenvio(userId, winner);
      }
      throw e;
    }
  }

  async update(userId: string, id: string, dto: UpdateSessionDto) {
    if (dto.startedAt === undefined && dto.finishedAt === undefined) {
      throw new BadRequestException('Informe startedAt e/ou finishedAt');
    }
    const owned = await this.prisma.workoutSession.findFirst({
      where: { id: id.toLowerCase(), userId },
    });
    if (!owned) throw new NotFoundException('Sessão não encontrada');
    return this.prisma.workoutSession.update({
      where: { id: owned.id },
      data: {
        startedAt:
          dto.startedAt === undefined ? undefined : new Date(dto.startedAt),
        finishedAt:
          dto.finishedAt === undefined ? undefined : new Date(dto.finishedAt),
      },
    });
  }

  async createSet(userId: string, sessionId: string, dto: CreateSetDto) {
    dto = { ...dto, id: dto.id.toLowerCase() };
    const session = await this.prisma.workoutSession.findFirst({
      where: { id: sessionId.toLowerCase(), userId },
    });
    if (!session) throw new NotFoundException('Sessão não encontrada');

    const existing = await this.reenvioSet(userId, session.id, dto.id);
    if (existing) return existing;

    const exercise = await this.prisma.exercise.findUnique({
      where: { id: dto.exerciseId },
    });
    if (!exercise) throw new NotFoundException('Exercício não encontrado');

    try {
      const set = await this.prisma.setLog.create({
        data: { ...dto, sessionId: session.id },
      });
      return { created: true, set };
    } catch (e) {
      if (isP2002(e)) {
        const winner = await this.reenvioSet(userId, session.id, dto.id);
        if (winner) return winner;
        throw new ConflictException('Número de série já registrado');
      }
      throw e;
    }
  }

  async updateSet(
    userId: string,
    sessionId: string,
    setId: string,
    dto: UpdateSetDto,
  ) {
    if (Object.values(dto).every((v) => v === undefined)) {
      throw new BadRequestException('Informe ao menos um campo da série');
    }
    const set = await this.prisma.setLog.findFirst({
      where: {
        id: setId.toLowerCase(),
        sessionId: sessionId.toLowerCase(),
        workoutSession: { userId },
      },
    });
    if (!set) throw new NotFoundException('Série não encontrada');
    try {
      return await this.prisma.setLog.update({
        where: { id: set.id },
        data: dto,
      });
    } catch (e) {
      if (isP2002(e)) {
        throw new ConflictException('Número de série já registrado');
      }
      throw e;
    }
  }

  // Série com esse id: do usuário, na mesma sessão → reenvio (200); de outro usuário ou de outra sessão → 409.
  private async reenvioSet(userId: string, sessionId: string, id: string) {
    const set = await this.prisma.setLog.findUnique({ where: { id } });
    if (!set) return null;
    const owner = await this.prisma.workoutSession.findUnique({
      where: { id: set.sessionId },
    });
    if (owner?.userId !== userId || set.sessionId !== sessionId) {
      throw new ConflictException('Id de série já utilizado');
    }
    return { created: false, set };
  }

  private reenvio(userId: string, session: { userId: string }) {
    if (session.userId !== userId) {
      throw new ConflictException('Id de sessão já utilizado');
    }
    return { created: false, session };
  }
}
