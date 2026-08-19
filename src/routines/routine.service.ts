import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateRoutineDto } from './dto/create-routine.dto';

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
}
