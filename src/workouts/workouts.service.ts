import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateWorkoutDto } from './dto/create-workout.dto';
import { NotFoundException } from '@nestjs/common';
import { UpdateWorkoutDto } from './dto/update-workout.dto';

@Injectable()
export class WorkoutsService {
  constructor(private readonly prisma: PrismaService) {}

  private async assertExercisesVisible(
    userId: string,
    items: { exerciseId: string }[],
  ) {
    const ids = [...new Set(items.map((i) => i.exerciseId))];
    const found = await this.prisma.exercise.count({
      where: { id: { in: ids }, OR: [{ userId: null }, { userId }] },
    });
    if (found !== ids.length) {
      throw new BadRequestException('Exercício não encontrado');
    }
  }

  async create(userId: string, dto: CreateWorkoutDto) {
    await this.assertExercisesVisible(userId, dto.items);
    return await this.prisma.workout.create({
      data: {
        userId: userId,
        name: dto.name,
        description: dto.description,
        items: {
          create: dto.items.map((item) => ({
            exerciseId: item.exerciseId,
            order: item.order,
            targetSets: item.targetSets,
            targetReps: item.targetReps,
          })),
        },
      },
      include: {
        items: true,
      },
    });
  }

  async findAll(userId: string) {
    return await this.prisma.workout.findMany({
      where: { userId },
      include: {
        items: {
          include: {
            exercise: true,
          },
          orderBy: {
            order: 'asc',
          },
        },
      },
    });
  }

  async findOne(userId: string, id: string) {
    const workout = await this.prisma.workout.findFirst({
      where: {
        id,
        userId,
      },
      include: {
        items: {
          include: {
            exercise: true,
          },
          orderBy: {
            order: 'asc',
          },
        },
      },
    });

    if (!workout) {
      throw new NotFoundException('Treino não encontrado');
    }

    return workout;
  }

  async update(userId: string, id: string, dto: UpdateWorkoutDto) {
    await this.findOne(userId, id);
    if (dto.items) await this.assertExercisesVisible(userId, dto.items);

    return await this.prisma.$transaction(async (tx) => {
      if (dto.items) {
        await tx.workoutItem.deleteMany({
          where: { workoutId: id },
        });
      }

      return await tx.workout.update({
        where: { id },
        data: {
          name: dto.name,
          description: dto.description,
          ...(dto.items && {
            items: {
              create: dto.items.map((item) => ({
                exerciseId: item.exerciseId,
                order: item.order,
                targetSets: item.targetSets,
                targetReps: item.targetReps,
              })),
            },
          }),
        },
        include: {
          items: {
            include: {
              exercise: true,
            },
            orderBy: {
              order: 'asc',
            },
          },
        },
      });
    });
  }
}
