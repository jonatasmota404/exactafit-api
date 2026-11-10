import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateSessionDto } from './dto/create-session.dto';

@Injectable()
export class SessionsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(userId: string, dto: CreateSessionDto) {
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
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === 'P2002'
      ) {
        const winner = await this.prisma.workoutSession.findUnique({
          where: { id: dto.id },
        });
        if (winner) return this.reenvio(userId, winner);
      }
      throw e;
    }
  }

  private reenvio(userId: string, session: { userId: string }) {
    if (session.userId !== userId) {
      throw new ConflictException('Id de sessão já utilizado');
    }
    return { created: false, session };
  }
}
