import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { AuthGuard } from '../auth/auth.guard';
import { CreateMealLogDto } from './dto/create-meal-log.dto';
import { MealLogsService } from './meal-logs.service';

interface AuthenticatedRequest extends Request {
  user: { sub: string; email?: string };
}

@UseGuards(AuthGuard)
@Controller('meal-logs')
export class MealLogsController {
  constructor(private readonly service: MealLogsService) {}

  @Post()
  async create(
    @Req() req: AuthenticatedRequest,
    @Body() dto: CreateMealLogDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { created, log } = await this.service.create(req.user.sub, dto);
    res.status(created ? 201 : 200);
    return log;
  }

  @Get(':id')
  findOne(
    @Req() req: AuthenticatedRequest,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    return this.service.findOne(req.user.sub, id);
  }
}
