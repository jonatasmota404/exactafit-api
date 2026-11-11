import {
  IsString,
  IsNotEmpty,
  IsUUID,
  IsOptional,
  IsInt,
  IsArray,
  ValidateNested,
  MaxLength,
  Min,
  Max,
  IsEnum,
  IsBoolean,
  IsNumber,
  ValidateIf,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ProgressionType, SetType } from '@prisma/client';
import { INT4_MAX } from '../../sessions/dto/create-set.dto';

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
  @Min(0)
  @Max(INT4_MAX)
  order!: number;

  @IsInt()
  @Min(1)
  @Max(20)
  targetSets!: number;

  @ValidateIf((_, value) => value !== undefined)
  @IsEnum(SetType)
  setType?: SetType;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  targetRepsMin?: number | null;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  targetRepsMax?: number | null;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(14400)
  targetDurationSeconds?: number | null;

  @ValidateIf((_, value) => value !== undefined)
  @IsBoolean()
  perSide?: boolean;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(600)
  restSeconds?: number | null;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(50)
  supersetGroup?: number | null;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(5)
  rir?: number | null;

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(10)
  rpe?: number | null;

  @ValidateIf((_, value) => value !== undefined)
  @IsEnum(ProgressionType)
  progressionType?: ProgressionType;

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(10)
  progressionStepPercent?: number | null;
}
