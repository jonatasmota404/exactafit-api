import {
  BadRequestException,
  Body,
  Controller,
  HttpCode,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import type { AuthenticatedRequest } from '../sessions/sessions.controller';
import { SyncDto } from './dto/sync.dto';
import { SyncService } from './sync.service';

@Controller('sync')
@UseGuards(AuthGuard)
export class SyncController {
  constructor(private readonly syncService: SyncService) {}

  @Post()
  @HttpCode(200)
  sync(@Req() req: AuthenticatedRequest, @Body() dto: SyncDto) {
    // O ValidationPipe deixa passar um array no lugar do objeto do lote.
    if (Array.isArray(dto)) {
      throw new BadRequestException('O corpo deve ser um objeto');
    }
    return this.syncService.sync(req['user'].sub, dto);
  }
}
