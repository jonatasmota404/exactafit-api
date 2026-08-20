import { IsEmail, IsString, MinLength, MaxLength } from 'class-validator';

export class LoginUserDto {
  @IsEmail({}, { message: 'E-mail inválido' })
  @MaxLength(255)
  email!: string;

  @IsString()
  @MinLength(6, { message: 'A senha deve ter no mínimo 6 caracteres' })
  @MaxLength(72)
  password!: string;
}
