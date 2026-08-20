import {
  IsString,
  IsNotEmpty,
  IsUUID,
  IsOptional,
  IsInt,
  IsArray,
  ValidateNested,
  MaxLength,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateRoutineDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  description?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateRoutineItemDto)
  items!: CreateRoutineItemDto[];
}

export class CreateRoutineItemDto {
  @IsUUID()
  exerciseId!: string;
  @IsInt()
  order!: number;
  @IsInt()
  targetSets!: number;
  @IsInt()
  targetReps!: number;
}
