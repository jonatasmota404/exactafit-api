import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Request } from 'express';
import { PrismaService } from '../prisma/prisma.service';
import 'dotenv/config';

interface JwtPayload {
  sub: string;
  email: string;
}

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtService,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();

    const token = this.extractTokenFromHeader(request);

    if (!token) {
      throw new UnauthorizedException('Token inválido');
    }

    let payload: JwtPayload;
    try {
      payload = await this.jwtService.verifyAsync<JwtPayload>(token, {
        secret: process.env.JWT_SECRET,
      });
    } catch {
      throw new UnauthorizedException('Token inválido');
    }

    if (typeof payload.sub !== 'string') {
      throw new UnauthorizedException('Token inválido');
    }

    // Fora do try: erro do banco sobe como 500, não como sessão inválida.
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      select: { deactivatedAt: true },
    });
    if (!user || user.deactivatedAt) {
      throw new UnauthorizedException('Token inválido');
    }

    request['user'] = payload;

    return true;
  }

  private extractTokenFromHeader(req: Request) {
    const [type, token] = req.headers.authorization?.split(' ') ?? [];
    return type === 'Bearer' ? token : undefined;
  }
}
