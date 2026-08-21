import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateRoutineDto } from './dto/create-routine.dto';
import { NotFoundException } from '@nestjs/common';
import { UpdateRoutineDto } from './dto/update-routine.dto';

@Injectable()
export class RoutineService {
  constructor(private readonly prisma: PrismaService) {}

  async create(userId: string, dto: CreateRoutineDto) {
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
