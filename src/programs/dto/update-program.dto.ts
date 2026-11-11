import { CycleType } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsString,
  Matches,
  MaxLength,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import { DATE_ONLY, ProgramDayDto } from './create-program.dto';

// Em todos os campos, null falha o validador de tipo (R4); só undefined é ignorado.
const present = (_: unknown, v: unknown) => v !== undefined;

export class UpdateProgramDto {
  @ValidateIf(present)
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name?: string;

  @ValidateIf(present)
  @IsEnum(CycleType)
  cycleType?: CycleType;

  @ValidateIf(present)
  @IsInt()
  cycleDays?: number;

  @ValidateIf(present)
  @IsInt()
  weeks?: number;

  @ValidateIf(present)
  @Matches(DATE_ONLY)
  startDate?: string;

  @ValidateIf(present)
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ProgramDayDto)
  days?: ProgramDayDto[];
}
