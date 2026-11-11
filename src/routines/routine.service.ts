import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateRoutineDto } from './dto/create-routine.dto';
import { NotFoundException } from '@nestjs/common';
import { UpdateRoutineDto } from './dto/update-routine.dto';

@Injectable()
export class RoutineService {
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

  async create(userId: string, dto: CreateRoutineDto) {
    await this.assertExercisesVisible(userId, dto.items);
    return await this.prisma.workoutRoutine.create({
      data: {
        userId: userId,
        name: dto.name,
        description: dto.description,
        routineItems: {
          create: dto.items.map((item) => ({
            exerciseId: item.exerciseId,
            order: item.order,
            targetSets: item.targetSets,
            targetReps: item.targetReps,
          })),
        },
      },
      include: {
        routineItems: true,
      },
    });
  }

  async findAll(userId: string) {
    return await this.prisma.workoutRoutine.findMany({
      where: { userId },
      include: {
        routineItems: {
          include: {
            exercices: true,
          },
          orderBy: {
            order: 'asc',
          },
        },
      },
    });
  }

  async findOne(userId: string, id: string) {
    const routine = await this.prisma.workoutRoutine.findFirst({
      where: {
        id,
        userId,
      },
      include: {
        routineItems: {
          include: {
            exercices: true,
          },
          orderBy: {
            order: 'asc',
          },
        },
      },
    });

    if (!routine) {
      throw new NotFoundException('Ficha de treino não encontrada');
    }

    return routine;
  }

  async update(userId: string, id: string, dto: UpdateRoutineDto) {
    await this.findOne(userId, id);
    if (dto.items) await this.assertExercisesVisible(userId, dto.items);

    return await this.prisma.$transaction(async (tx) => {
      if (dto.items) {
        await tx.routineItem.deleteMany({
          where: { routineId: id },
        });
      }

      return await tx.workoutRoutine.update({
        where: { id },
        data: {
          name: dto.name,
          description: dto.description,
          ...(dto.items && {
            routineItems: {
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
          routineItems: {
            include: {
              exercices: true,
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
