import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateWorkoutDto } from './dto/create-workout.dto';
import { NotFoundException } from '@nestjs/common';
import { UpdateWorkoutDto } from './dto/update-workout.dto';
import { CreateWorkoutItemDto } from './dto/create-workout.dto';

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

  private assertItemsValid(items: CreateWorkoutItemDto[]) {
    const groups = new Map<number, number>();
    for (const item of items) {
      const hasMin = item.targetRepsMin != null;
      const hasMax = item.targetRepsMax != null;
      if (hasMin !== hasMax) {
        throw new BadRequestException(
          'targetRepsMin e targetRepsMax devem vir juntos',
        );
      }
      if (hasMin && item.targetRepsMin! > item.targetRepsMax!) {
        throw new BadRequestException(
          'targetRepsMin não pode ser maior que targetRepsMax',
        );
      }
      if (!hasMin && item.targetDurationSeconds == null) {
        throw new BadRequestException(
          'Informe repetições ou duração em cada item',
        );
      }
      if (item.rir != null && item.rpe != null) {
        throw new BadRequestException('Informe rir ou rpe, não os dois');
      }
      if (item.rpe != null && !Number.isInteger(item.rpe * 2)) {
        throw new BadRequestException('rpe deve variar de 0,5 em 0,5');
      }
      const type = item.progressionType ?? 'NONE';
      const step = item.progressionStepPercent;
      if (step != null && !Number.isInteger(step * 2)) {
        throw new BadRequestException(
          'progressionStepPercent deve variar de 0,5 em 0,5',
        );
      }
      if (type === 'NONE' && step != null) {
        throw new BadRequestException(
          'progressionStepPercent exige progressionType DOUBLE ou LINEAR',
        );
      }
      if (type !== 'NONE' && (step == null || !hasMin)) {
        throw new BadRequestException(
          'Progressão exige progressionStepPercent e a faixa de repetições',
        );
      }
      if (item.supersetGroup != null) {
        groups.set(
          item.supersetGroup,
          (groups.get(item.supersetGroup) ?? 0) + 1,
        );
      }
    }
    for (const count of groups.values()) {
      if (count < 2) {
        throw new BadRequestException(
          'Superssérie precisa de pelo menos 2 itens',
        );
      }
    }
  }

  async create(userId: string, dto: CreateWorkoutDto) {
    this.assertItemsValid(dto.items);
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
            setType: item.setType,
            targetRepsMin: item.targetRepsMin ?? null,
            targetRepsMax: item.targetRepsMax ?? null,
            targetDurationSeconds: item.targetDurationSeconds ?? null,
            perSide: item.perSide,
            restSeconds: item.restSeconds ?? null,
            supersetGroup: item.supersetGroup ?? null,
            rir: item.rir ?? null,
            rpe: item.rpe ?? null,
            progressionType: item.progressionType,
            progressionStepPercent: item.progressionStepPercent ?? null,
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
    if (dto.items) this.assertItemsValid(dto.items);
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
                setType: item.setType,
                targetRepsMin: item.targetRepsMin ?? null,
                targetRepsMax: item.targetRepsMax ?? null,
                targetDurationSeconds: item.targetDurationSeconds ?? null,
                perSide: item.perSide,
                restSeconds: item.restSeconds ?? null,
                supersetGroup: item.supersetGroup ?? null,
                rir: item.rir ?? null,
                rpe: item.rpe ?? null,
                progressionType: item.progressionType,
                progressionStepPercent: item.progressionStepPercent ?? null,
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
