import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateSessionDto } from './dto/create-session.dto';

@Injectable()
export class SessionsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(userId: string, dto: CreateSessionDto) {
    const routine = await this.prisma.workoutRoutine.findFirst({
      where: {
        id: dto.routineId,
        userId: userId,
      },
    });
    if (!routine) {
      throw new NotFoundException('Ficha de treino não encontrada');
    }
    return await this.prisma.workoutSession.create({
      data: {
        userId,
        routineId: dto.routineId,
      },
    });
  }
}
