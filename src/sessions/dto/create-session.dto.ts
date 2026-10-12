import { IsUUID, IsNotEmpty } from 'class-validator';

export class CreateSessionDto {
  @IsNotEmpty()
  @IsUUID('4', { message: 'Preciso de um UUid válido' })
  routineId!: string;
}
