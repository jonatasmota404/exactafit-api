import {
  Body,
  Controller,
  Param,
  Patch,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import { AuthGuard } from '../auth/auth.guard';
import { CreateSessionDto } from './dto/create-session.dto';
import { CreateSetDto } from './dto/create-set.dto';
import { UpdateSessionDto } from './dto/update-session.dto';
import { UpdateSetDto } from './dto/update-set.dto';
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

  @Patch(':id')
  update(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() dto: UpdateSessionDto,
  ) {
    return this.sessionService.update(req['user'].sub, id, dto);
  }

  @Post(':id/sets')
  async createSet(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() dto: CreateSetDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { created, set } = await this.sessionService.createSet(
      req['user'].sub,
      id,
      dto,
    );
    res.status(created ? 201 : 200);
    return set;
  }

  @Patch(':id/sets/:setId')
  updateSet(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Param('setId') setId: string,
    @Body() dto: UpdateSetDto,
  ) {
    return this.sessionService.updateSet(req['user'].sub, id, setId, dto);
  }
}
