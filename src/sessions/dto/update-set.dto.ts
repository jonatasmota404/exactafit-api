import {
  IsBoolean,
  IsInt,
  IsNumber,
  IsOptional,
  Max,
  Min,
  ValidateIf,
} from 'class-validator';

// weightKg, repsCompleted e durationSeconds aceitam null (limpar);
// failed e setNumber não: só undefined é pulado.
export class UpdateSetDto {
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(9999.99)
  weightKg?: number | null;

  @IsOptional()
  @IsInt()
  @Min(0)
  repsCompleted?: number | null;

  @IsOptional()
  @IsInt()
  @Min(0)
  durationSeconds?: number | null;

  @ValidateIf((o: UpdateSetDto) => o.failed !== undefined)
  @IsBoolean()
  failed?: boolean;

  @ValidateIf((o: UpdateSetDto) => o.setNumber !== undefined)
  @IsInt()
  @Min(1)
  setNumber?: number;
}
