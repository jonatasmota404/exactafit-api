import { IsNumber, Max, Min } from 'class-validator';

// Decimal(6,2) guarda até 9999.99; 0 não entra (A7: fator > 0).
export class UpdateFoodYieldDto {
  @IsNumber({ allowNaN: false, allowInfinity: false, maxDecimalPlaces: 2 })
  @Min(0.01)
  @Max(9999.99)
  factor!: number;
}
