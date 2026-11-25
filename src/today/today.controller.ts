import { Controller, Get, Query, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { AuthGuard } from '../auth/auth.guard';
import { TodayQueryDto } from './dto/today-query.dto';
import { TodayService } from './today.service';

interface AuthenticatedRequest extends Request {
  user: { sub: string; email?: string };
}

@UseGuards(AuthGuard)
@Controller('today')
export class TodayController {
  constructor(private readonly service: TodayService) {}

  @Get()
  get(@Req() req: AuthenticatedRequest, @Query() query: TodayQueryDto) {
    return this.service.get(req.user.sub, query.date, query.dayTypeId);
  }
}
