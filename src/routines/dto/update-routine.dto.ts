import { OmitType, PartialType } from '@nestjs/mapped-types';
import { IsNotEmpty, IsString, MaxLength, ValidateIf } from 'class-validator';
import { CreateRoutineDto } from './create-routine.dto';

export class UpdateRoutineDto extends PartialType(
  OmitType(CreateRoutineDto, ['name'] as const),
) {
  @ValidateIf((_, value) => value !== undefined)
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name?: string;
}
