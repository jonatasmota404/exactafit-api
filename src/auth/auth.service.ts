import { Injectable, ConflictException, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RegisterUserDto } from './dto/register.dto';
import * as bcrypt from 'bcrypt';
import { LoginUserDto } from './dto/login.dto';
import { JwtService } from '@nestjs/jwt';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService
  ) {}

  async create(dataDto: RegisterUserDto) {
    const userExists = await this.prisma.user.findUnique({
      where: { email: dataDto.email },
    });

    if (userExists) {
      throw new ConflictException('E-mail já cadastrado');
    }

    const salt = 10;
    const hashPassword = await bcrypt.hash(dataDto.password, salt);

    const user = await this.prisma.user.create({
      data: {
        name: dataDto.name,
        email: dataDto.email,
        password: hashPassword,
      },
    });

    delete (user as { password?: string }).password;
    return user;
  }

  async login(dataDto: LoginUserDto){
    const user = await this.prisma.user.findUnique({
      where: { email: dataDto.email },
    });

    if (!user) {
        throw new UnauthorizedException('Credenciais inválidas');
    }
    
    const validPassword = await bcrypt.compare(dataDto.password, user.password)

    if (!validPassword) {
        throw new UnauthorizedException('Credenciais inválidas');
    }

    const payload = {sub: user.id, email: user.email };
    const token = await this.jwtService.signAsync(payload);
    return {accessToken: token };

  }
}
