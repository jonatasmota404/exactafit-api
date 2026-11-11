import {
  IsBoolean,
  IsInt,
  IsNumber,
  IsOptional,
  IsUUID,
  Max,
  Min,
} from 'class-validator';

// Maior inteiro da coluna int4 do Postgres; acima disso o Prisma dá 500.
export const INT4_MAX = 2147483647;

export class CreateSetDto {
  @IsUUID()
  id!: string;

  @IsUUID()
  exerciseId!: string;

  @IsInt()
  @Min(1)
  @Max(INT4_MAX)
  setNumber!: number;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(9999.99)
  weightKg?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(INT4_MAX)
  repsCompleted?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(INT4_MAX)
  durationSeconds?: number;

  @IsOptional()
  @IsBoolean()
  failed?: boolean;
}
