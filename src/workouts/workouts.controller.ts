import {
  Body,
  Post,
  Controller,
  UseGuards,
  Req,
  Get,
  Param,
  ParseUUIDPipe,
  Put,
} from '@nestjs/common';
import { CreateWorkoutDto } from './dto/create-workout.dto';
import { AuthGuard } from '../auth/auth.guard';
import type { Request } from 'express';
import { WorkoutsService } from './workouts.service';
import { UpdateWorkoutDto } from './dto/update-workout.dto';

export interface AuthenticatedRequest extends Request {
  user: {
    sub: string;
    email?: string;
  };
}

@UseGuards(AuthGuard)
@Controller('workouts')
export class WorkoutsController {
  constructor(private readonly workoutsService: WorkoutsService) {}
  @Post()
  create(@Req() req: AuthenticatedRequest, @Body() dto: CreateWorkoutDto) {
    const userId = req['user'].sub;
    return this.workoutsService.create(userId, dto);
  }

  @Get()
  findAll(@Req() req: AuthenticatedRequest) {
    const userId = req['user'].sub;
    return this.workoutsService.findAll(userId);
  }

  @Get(':id')
  findOne(
    @Req() req: AuthenticatedRequest,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    const userId = req.user.sub;
    return this.workoutsService.findOne(userId, id);
  }

  @Put(':id')
  update(
    @Req() req: AuthenticatedRequest,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateWorkoutDto,
  ) {
    const userId = req.user.sub;
    return this.workoutsService.update(userId, id, dto);
  }
}
