import { Controller, Get, Post, Body, UseGuards } from '@nestjs/common';
import { ExercisesService } from './exercises.service';
import { CreateExercisesDto } from './dto/create-exercises.dto';
import { AuthGuard } from '../auth/auth.guard';


@UseGuards(AuthGuard)
@Controller('exercises')
export class ExercisesController {
  constructor(private readonly exercisesService: ExercisesService) {}

  @Post()
  create(@Body() dto: CreateExercisesDto) {
    return this.exercisesService.create(dto);
  }
  @Get()
  list() {
    return this.exercisesService.list();
  }
}
