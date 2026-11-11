import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CycleType, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ProgramDayDto } from './dto/create-program.dto';
import { CreateProgramDto } from './dto/create-program.dto';
import { UpdateProgramDto } from './dto/update-program.dto';

const NOT_FOUND = 'Programa não encontrado';

const withDays = {
  days: {
    orderBy: [{ week: 'asc' }, { day: 'asc' }, { order: 'asc' }],
    include: { workout: { select: { id: true, name: true } } },
  },
} satisfies Prisma.ProgramInclude;

type Tx = Prisma.TransactionClient;

interface Cycle {
  cycleType: CycleType;
  cycleDays: number;
  weeks: number;
}

@Injectable()
export class ProgramsService {
  constructor(private readonly prisma: PrismaService) {}

  // R7: startDate sai como 'AAAA-MM-DD', sem conversão de fuso.
  private out<T extends { startDate: Date }>(p: T) {
    return { ...p, startDate: p.startDate.toISOString().slice(0, 10) };
  }

  private parseDate(value: string) {
    const date = new Date(`${value}T00:00:00.000Z`);
    if (isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) {
      throw new BadRequestException('startDate inválida');
    }
    return date;
  }

  // Confere o estado final do ciclo (R2, R6, decisão (d)).
  private validateCycle(c: Cycle, days: ProgramDayDto[]) {
    const weekly = c.cycleType === CycleType.WEEKLY;
    if (weekly ? c.cycleDays !== 7 : c.cycleDays < 2 || c.cycleDays > 14) {
      throw new BadRequestException('cycleDays fora do limite do ciclo');
    }
    if (weekly ? c.weeks < 1 || c.weeks > 4 : c.weeks !== 1) {
      throw new BadRequestException('weeks fora do limite do ciclo');
    }
    const seen = new Set<string>();
    for (const d of days) {
      if (d.week > c.weeks || d.day > c.cycleDays) {
        throw new BadRequestException('Dia fora do ciclo');
      }
      const key = `${d.week}:${d.day}:${d.order}`;
      if (seen.has(key)) {
        throw new BadRequestException('order repetido no mesmo dia');
      }
      seen.add(key);
    }
  }

  private async assertWorkouts(tx: Tx, userId: string, days: ProgramDayDto[]) {
    const ids = [...new Set(days.map((d) => d.workoutId))];
    const found = await tx.workout.count({
      where: { id: { in: ids }, userId },
    });
    if (found !== ids.length) {
      throw new BadRequestException('Treino não encontrado');
    }
  }

  private dayRows(days: ProgramDayDto[]) {
    return days.map((d) => ({
      week: d.week,
      day: d.day,
      workoutId: d.workoutId,
      order: d.order,
    }));
  }

  private async load(tx: Tx, userId: string, id: string) {
    const program = await tx.program.findFirst({
      where: { id, userId },
      include: withDays,
    });
    if (!program) throw new NotFoundException(NOT_FOUND);
    return this.out(program);
  }

  async create(userId: string, dto: CreateProgramDto) {
    const weekly = dto.cycleType === CycleType.WEEKLY;
    const cycleDays = dto.cycleDays ?? (weekly ? 7 : undefined);
    if (cycleDays === undefined) {
      throw new BadRequestException('cycleDays é obrigatório no rotativo');
    }
    const weeks = dto.weeks ?? 1;
    const days = dto.days ?? [];
    const startDate = this.parseDate(dto.startDate);
    this.validateCycle({ cycleType: dto.cycleType, cycleDays, weeks }, days);
    return this.prisma.$transaction(async (tx) => {
      await this.assertWorkouts(tx, userId, days);
      const created = await tx.program.create({
        data: {
          userId,
          name: dto.name,
          cycleType: dto.cycleType,
          cycleDays,
          weeks,
          startDate,
          days: { create: this.dayRows(days) },
        },
        include: withDays,
      });
      return this.out(created);
    });
  }

  async findAll(userId: string) {
    const programs = await this.prisma.program.findMany({
      where: { userId },
      include: withDays,
      orderBy: { createdAt: 'asc' },
    });
    return programs.map((p) => this.out(p));
  }

  findOne(userId: string, id: string) {
    return this.load(this.prisma, userId, id);
  }

  async update(userId: string, id: string, dto: UpdateProgramDto) {
    const startDate =
      dto.startDate === undefined ? undefined : this.parseDate(dto.startDate);
    return this.prisma.$transaction(async (tx) => {
      const rows = await tx.$queryRaw<
        { cycle_type: CycleType; cycle_days: number; weeks: number }[]
      >`SELECT cycle_type, cycle_days, weeks FROM programs WHERE id = ${id} AND user_id = ${userId} FOR UPDATE`;
      if (rows.length === 0) throw new NotFoundException(NOT_FOUND);
      const cycle: Cycle = {
        cycleType: dto.cycleType ?? rows[0].cycle_type,
        cycleDays: dto.cycleDays ?? rows[0].cycle_days,
        weeks: dto.weeks ?? rows[0].weeks,
      };
      const days =
        dto.days ??
        (await tx.programDay.findMany({
          where: { programId: id, program: { userId } },
        }));
      this.validateCycle(cycle, days);
      if (dto.days) await this.assertWorkouts(tx, userId, dto.days);
      await tx.program.updateMany({
        where: { id, userId },
        data: {
          name: dto.name,
          cycleType: dto.cycleType,
          cycleDays: dto.cycleDays,
          weeks: dto.weeks,
          startDate,
        },
      });
      if (dto.days) {
        await tx.programDay.deleteMany({
          where: { programId: id, program: { userId } },
        });
        await tx.programDay.createMany({
          data: this.dayRows(dto.days).map((d) => ({ ...d, programId: id })),
        });
      }
      return this.load(tx, userId, id);
    });
  }

  async remove(userId: string, id: string) {
    const { count } = await this.prisma.program.deleteMany({
      where: { id, userId },
    });
    if (count === 0) throw new NotFoundException(NOT_FOUND);
  }

  // Desliga todos os programas do usuário (trava as linhas) e liga o escolhido;
  // se ele não existe, o 404 desfaz o desligamento.
  activate(userId: string, id: string) {
    return this.prisma.$transaction(async (tx) => {
      await tx.program.updateMany({
        where: { userId },
        data: { active: false },
      });
      const { count } = await tx.program.updateMany({
        where: { id, userId },
        data: { active: true },
      });
      if (count === 0) throw new NotFoundException(NOT_FOUND);
      return this.load(tx, userId, id);
    });
  }

  async deactivate(userId: string, id: string) {
    const { count } = await this.prisma.program.updateMany({
      where: { id, userId },
      data: { active: false },
    });
    if (count === 0) throw new NotFoundException(NOT_FOUND);
    return this.load(this.prisma, userId, id);
  }
}
