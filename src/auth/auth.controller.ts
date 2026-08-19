import { Controller, Post, Body } from '@nestjs/common';
import { AuthService } from './auth.service';
import { RegisterUserDto } from './dto/register.dto';
import { LoginUserDto } from './dto/login.dto';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  create(@Body() dto: RegisterUserDto) {
    return this.authService.create(dto);
  }

  @Post('login')
  login(@Body() dto: LoginUserDto) {
    return this.authService.login(dto);
  }
}
