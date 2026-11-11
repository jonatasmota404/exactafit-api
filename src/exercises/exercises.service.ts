import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateExercisesDto } from './dto/create-exercises.dto';

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
}
