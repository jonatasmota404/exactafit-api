import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  ParseUUIDPipe,
  Query,
  UseGuards,
  Req,
} from '@nestjs/common';
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

  @Get(':id/last-performance')
  lastPerformance(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Query('workoutItemId', new ParseUUIDPipe({ optional: true }))
    workoutItemId?: string,
  ) {
    return this.exercisesService.lastPerformance(
      req['user'].sub,
      id,
      workoutItemId,
    );
  }
}
