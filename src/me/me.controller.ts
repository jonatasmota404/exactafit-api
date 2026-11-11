import { Body, Controller, Get, Patch, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { AuthGuard } from '../auth/auth.guard';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { MeService } from './me.service';

interface AuthenticatedRequest extends Request {
  user: { sub: string; email?: string };
}

@UseGuards(AuthGuard)
@Controller('me')
export class MeController {
  constructor(private readonly meService: MeService) {}

  @Get('profile')
  getProfile(@Req() req: AuthenticatedRequest) {
    return this.meService.getProfile(req.user.sub);
  }

  @Patch('profile')
  updateProfile(
    @Req() req: AuthenticatedRequest,
    @Body() dto: UpdateProfileDto,
  ) {
    return this.meService.updateProfile(req.user.sub, dto);
  }
}
