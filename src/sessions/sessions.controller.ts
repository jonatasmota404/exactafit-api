import { Body, Controller, Post, Req, Res, UseGuards } from '@nestjs/common';
import type { Response } from 'express';
import { AuthGuard } from '../auth/auth.guard';
import { CreateSessionDto } from './dto/create-session.dto';
import { SessionsService } from './sessions.service';

export interface AuthenticatedRequest extends Request {
  user: {
    sub: string;
    email?: string;
  };
}

@Controller('sessions')
@UseGuards(AuthGuard)
export class SessionsController {
  constructor(private readonly sessionService: SessionsService) {}
  @Post()
  async create(
    @Req() req: AuthenticatedRequest,
    @Body() dto: CreateSessionDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const userId = req['user'].sub;
    const { created, session } = await this.sessionService.create(userId, dto);
    res.status(created ? 201 : 200);
    return session;
  }
}
