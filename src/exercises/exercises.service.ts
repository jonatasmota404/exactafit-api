import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { WorkoutItem } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateExercisesDto } from './dto/create-exercises.dto';
import { suggestLoad } from './progression';

@Injectable()
export class ExercisesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(userId: string, dataDto: CreateExercisesDto) {
    return this.prisma.exercise.create({
      data: { ...dataDto, userId },
    });
  }

  async list(userId: string) {
    return this.prisma.exercise.findMany({
      where: { OR: [{ userId: null }, { userId }] },
    });
  }

  async lastPerformance(
    userId: string,
    exerciseId: string,
    workoutItemId?: string,
  ) {
    const exercise = await this.prisma.exercise.findFirst({
      where: { id: exerciseId, OR: [{ userId: null }, { userId }] },
      select: { id: true },
    });
    if (!exercise) throw new NotFoundException('Exercício não encontrado');

    let item: WorkoutItem | null = null;
    if (workoutItemId) {
      item = await this.prisma.workoutItem.findFirst({
        where: { id: workoutItemId, workout: { userId } },
      });
      if (!item) throw new NotFoundException('Item não encontrado');
      if (item.exerciseId !== exerciseId) {
        throw new BadRequestException('Item não é deste exercício');
      }
    }

    const session = await this.prisma.workoutSession.findFirst({
      where: {
        userId,
        finishedAt: { not: null },
        setLogs: { some: { exerciseId } },
      },
      orderBy: [{ startedAt: 'desc' }, { finishedAt: 'desc' }, { id: 'desc' }],
      select: { id: true, startedAt: true, finishedAt: true },
    });
    if (!session) {
      return { exerciseId, session: null, sets: [], suggestion: null };
    }

    const sets = await this.prisma.setLog.findMany({
      where: { sessionId: session.id, exerciseId },
      orderBy: { setNumber: 'asc' },
      select: {
        setNumber: true,
        weightKg: true,
        repsCompleted: true,
        durationSeconds: true,
        failed: true,
      },
    });
    const result = item ? suggestLoad(sets, item) : null;
    return {
      exerciseId,
      session,
      sets,
      suggestion: result && { ...result, rule: item!.progressionType },
    };
  }
}
