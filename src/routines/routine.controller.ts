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
import { CreateRoutineDto } from './dto/create-routine.dto';
import { AuthGuard } from '../auth/auth.guard';
import type { Request } from 'express';
import { RoutineService } from './routine.service';
import { UpdateRoutineDto } from './dto/update-routine.dto';

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

  @Get()
  findAll(@Req() req: AuthenticatedRequest) {
    const userId = req['user'].sub;
    return this.routineService.findAll(userId);
  }

  @Get(':id')
  findOne(
    @Req() req: AuthenticatedRequest,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    const userId = req.user.sub;
    return this.routineService.findOne(userId, id);
  }

  @Put(':id')
  update(
    @Req() req: AuthenticatedRequest,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateRoutineDto,
  ) {
    const userId = req.user.sub;
    return this.routineService.update(userId, id, dto);
  }
}
