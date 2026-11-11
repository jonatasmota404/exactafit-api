import { FoodState, FoodTag } from '@prisma/client';
import {
  ArrayUnique,
  IsArray,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator';
import { NO_NUL } from '../../programs/dto/create-program.dto';
import { OneDecimal } from './create-food.dto';

// null só é aceito em fiberG (limpa); nos demais campos falha o validador de tipo.
const present = (_: unknown, v: unknown) => v !== undefined;
const num = { allowNaN: false, allowInfinity: false };

export class UpdateFoodDto {
  @ValidateIf(present)
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  @Matches(NO_NUL, { message: 'name não aceita byte nulo' })
  name?: string;

  @ValidateIf(present)
  @IsEnum(FoodState)
  state?: FoodState;

  @ValidateIf(present)
  @IsNumber(num)
  @OneDecimal()
  @Min(0)
  @Max(900)
  kcal?: number;

  @ValidateIf(present)
  @IsNumber(num)
  @OneDecimal()
  @Min(0)
  @Max(100)
  proteinG?: number;

  @ValidateIf(present)
  @IsNumber(num)
  @OneDecimal()
  @Min(0)
  @Max(100)
  carbsG?: number;

  @ValidateIf(present)
  @IsNumber(num)
  @OneDecimal()
  @Min(0)
  @Max(100)
  fatG?: number;

  @ValidateIf((_, v) => v !== undefined && v !== null)
  @IsNumber(num)
  @OneDecimal()
  @Min(0)
  @Max(100)
  fiberG?: number | null;

  @ValidateIf(present)
  @IsArray()
  @IsEnum(FoodTag, { each: true })
  @ArrayUnique()
  tags?: FoodTag[];
}
