import { CycleType } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsObject,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import { INT4_MAX } from '../../sessions/dto/create-set.dto';

// O Postgres não guarda o byte nulo em texto: sem isto, 500.
// eslint-disable-next-line no-control-regex -- o byte nulo é justamente o que se recusa
export const NO_NUL = /^[^\u0000]*$/;

export const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

export class ProgramDayDto {
  @IsInt()
  @Min(1)
  @Max(INT4_MAX)
  week!: number;

  @IsInt()
  @Min(1)
  @Max(INT4_MAX)
  day!: number;

  @IsUUID()
  workoutId!: string;

  @IsInt()
  @Min(0)
  @Max(INT4_MAX)
  order!: number;
}

export class CreateProgramDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  @Matches(NO_NUL, { message: 'name não aceita byte nulo' })
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
  @IsObject({ each: true })
  @ValidateNested({ each: true })
  @Type(() => ProgramDayDto)
  days?: ProgramDayDto[];
}
