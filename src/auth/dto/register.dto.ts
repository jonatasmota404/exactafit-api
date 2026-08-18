import { IsEmail, IsString, IsNotEmpty, MinLength } from 'class-validator';

export class RegisterUserDto {
  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsEmail({}, { message: 'E-mail inválido' })
  email!: string;

  @IsString()
  @MinLength(6, { message: 'A senha deve ter no mínimo 6 caracteres' })
  password!: string;
}
