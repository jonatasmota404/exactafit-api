import { Controller, Get, Post, Body, UseGuards, Req } from '@nestjs/common';
import type { Request } from 'express';
import { ExercisesService } from './exercises.service';
import { CreateExercisesDto } from './dto/create-exercises.dto';
import { AuthGuard } from '../auth/auth.guard';

interface AuthenticatedRequest extends Request {
  user: { sub: string };
}

@UseGuards(AuthGuard)
@Controller('exercises')
export class ExercisesController {
  constructor(private readonly exercisesService: ExercisesService) {}

  @Post()
  create(@Req() req: AuthenticatedRequest, @Body() dto: CreateExercisesDto) {
    return this.exercisesService.create(req['user'].sub, dto);
  }
  @Get()
  list(@Req() req: AuthenticatedRequest) {
    return this.exercisesService.list(req['user'].sub);
  }
}
