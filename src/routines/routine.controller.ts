import { Body, Post, Controller, UseGuards, Req } from '@nestjs/common';
import { CreateRoutineDto } from './dto/create-routine.dto';
import { AuthGuard } from '../auth/auth.guard';
import type { Request } from 'express';
import { RoutineService } from './routine.service';

@UseGuards(AuthGuard)
@Controller('routine')
export class RoutineController {
  constructor(private readonly routineService: RoutineService) {}
  @Post()
  create(@Req() req: Request, @Body() dto: CreateRoutineDto) {
    const userId = req['user'].sub;
    return this.routineService.create(userId, dto);
  }
}
