import { Body, Controller, Post, Req, UseGuards } from '@nestjs/common';
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
    constructor(private readonly sessionService: SessionsService){}
    @Post()

    create(@Req() req: AuthenticatedRequest, @Body() dto: CreateSessionDto){
        const userId = req['user'].sub;
        return this.sessionService.create(userId, dto);
    }
}
