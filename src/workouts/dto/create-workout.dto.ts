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

export class CreateWorkoutDto {
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
  @Type(() => CreateWorkoutItemDto)
  items!: CreateWorkoutItemDto[];
}

export class CreateWorkoutItemDto {
  @IsUUID()
  exerciseId!: string;
  @IsInt()
  order!: number;
  @IsInt()
  targetSets!: number;
  @IsInt()
  targetReps!: number;
}
