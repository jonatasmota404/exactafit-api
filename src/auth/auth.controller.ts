import { Controller, Get, Post, Body } from "@nestjs/common";
import { AuthService } from "./auth.service";
import { RegisterUserDto } from "./dto/register.dto";

@Controller('auth')

export class AuthController {
    constructor(private readonly authService: AuthService) {}

    @Post('register')
    create(@Body() dto: RegisterUserDto){
        return this.authService.create(dto);
    }

}
