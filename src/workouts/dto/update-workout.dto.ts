import { OmitType, PartialType } from '@nestjs/mapped-types';
import { IsNotEmpty, IsString, MaxLength, ValidateIf } from 'class-validator';
import { CreateWorkoutDto } from './create-workout.dto';

export class UpdateWorkoutDto extends PartialType(
  OmitType(CreateWorkoutDto, ['name'] as const),
) {
  @ValidateIf((_, value) => value !== undefined)
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name?: string;
}
