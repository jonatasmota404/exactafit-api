import { CycleType } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  Min,
  ValidateIf,
  ValidateNested,
} from 'class-validator';

export const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

export class ProgramDayDto {
  @IsInt()
  @Min(1)
  week!: number;

  @IsInt()
  @Min(1)
  day!: number;

  @IsUUID()
  workoutId!: string;

  @IsInt()
  @Min(0)
  order!: number;
}

export class CreateProgramDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name!: string;

  @IsEnum(CycleType)
  cycleType!: CycleType;

  @ValidateIf((_, v) => v !== undefined)
  @IsInt()
  cycleDays?: number;

  @ValidateIf((_, v) => v !== undefined)
  @IsInt()
  weeks?: number;

  @Matches(DATE_ONLY)
  startDate!: string;

  @ValidateIf((_, v) => v !== undefined)
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ProgramDayDto)
  days?: ProgramDayDto[];
}
