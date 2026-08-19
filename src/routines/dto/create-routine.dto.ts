import {
  IsString,
  IsNotEmpty,
  IsUUID,
  IsOptional,
  IsInt,
  IsArray,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateRoutineDto {
  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsOptional()
  @IsString()
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
