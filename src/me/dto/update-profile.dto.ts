import { Sex } from '@prisma/client';
import {
  IsEnum,
  IsInt,
  IsString,
  Matches,
  MaxLength,
  Max,
  Min,
  ValidateIf,
} from 'class-validator';

export const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

// timezone: null falha o validador de tipo (400); só undefined é ignorado.
const present = (_: unknown, v: unknown) => v !== undefined;
// sex, birthDate e heightCm: null limpa o campo.
const nullable = (_: unknown, v: unknown) => v !== undefined && v !== null;

export class UpdateProfileDto {
  @ValidateIf(nullable)
  @IsEnum(Sex)
  sex?: Sex | null;

  @ValidateIf(nullable)
  @Matches(DATE_ONLY)
  birthDate?: string | null;

  @ValidateIf(nullable)
  @IsInt()
  @Min(100)
  @Max(250)
  heightCm?: number | null;

  @ValidateIf(present)
  @IsString()
  @MaxLength(64)
  @Matches(/^[A-Za-z][A-Za-z0-9_+\-/]*$/)
  timezone?: string;
}
