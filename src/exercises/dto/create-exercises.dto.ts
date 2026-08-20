import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateExercisesDto {
  @IsNotEmpty()
  @IsString()
  @MaxLength(100)
  name!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  muscleGroup!: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  type?: string;
}
