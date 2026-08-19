import { Body, Post, Controller, UseGuards, Req } from '@nestjs/common';
import { CreateRoutineDto } from './dto/create-routine.dto';
import { AuthGuard } from '../auth/auth.guard';
import type { Request } from 'express';
import { RoutineService } from './routine.service';

export interface AuthenticatedRequest extends Request {
  user: {
    sub: string;
    email?: string;
  };
}

@UseGuards(AuthGuard)
@Controller('routine')
export class RoutineController {
  constructor(private readonly routineService: RoutineService) {}
  @Post()
  create(@Req() req: AuthenticatedRequest, @Body() dto: CreateRoutineDto) {
    const userId = req['user'].sub;
    return this.routineService.create(userId, dto);
  }
}
