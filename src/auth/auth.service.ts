import { Injectable, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RegisterUserDto } from './dto/register.dto';
import * as bcrypt from 'bcrypt';

@Injectable()
export class AuthService {
  constructor(private readonly prisma: PrismaService) {}

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
}
