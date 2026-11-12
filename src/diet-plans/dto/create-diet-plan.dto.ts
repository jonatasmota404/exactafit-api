import { applyDecorators } from '@nestjs/common';
import { Type } from 'class-transformer';
import {
  ArrayNotEmpty,
  IsArray,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsObject,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import { OneDecimal } from '../../foods/dto/create-food.dto';
import { NO_NUL } from '../../programs/dto/create-program.dto';
import { INT4_MAX } from '../../sessions/dto/create-set.dto';

export const VALUE_FIELDS = [
  'kcal',
  'proteinG',
  'carbsG',
  'fatG',
  'fiberG',
] as const;

const Value = () =>
  applyDecorators(
    ValidateIf((_, v) => v !== undefined && v !== null),
    IsNumber({ allowNaN: false, allowInfinity: false }),
    OneDecimal(),
    Min(0),
    Max(99999.9),
  );

// Os cinco valores de uma meta (D3): todos opcionais; "pelo menos um" é conferido no service.
export class TargetValuesDto {
  @Value() kcal?: number | null;
  @Value() proteinG?: number | null;
  @Value() carbsG?: number | null;
  @Value() fatG?: number | null;
  @Value() fiberG?: number | null;
}

const Order = () => applyDecorators(IsInt(), Min(0), Max(INT4_MAX));

const Name = () =>
  applyDecorators(
    IsString(),
    IsNotEmpty(),
    MaxLength(100),
    Matches(NO_NUL, { message: 'name não aceita byte nulo' }),
  );

export class MealSlotDto {
  @Name() name!: string;
  @Order() order!: number;
}

export class MealTargetDto extends TargetValuesDto {
  @Order() mealSlotOrder!: number;
}

export class DayTypeDto extends TargetValuesDto {
  @Name() name!: string;
  @Order() order!: number;

  @ValidateIf((_, v) => v !== undefined)
  @IsArray()
  @IsObject({ each: true })
  @ValidateNested({ each: true })
  @Type(() => MealTargetDto)
  mealTargets?: MealTargetDto[];
}

export class CreateDietPlanDto {
  @Name() name!: string;

  @ValidateIf((_, v) => v !== undefined)
  @IsArray()
  @IsObject({ each: true })
  @ValidateNested({ each: true })
  @Type(() => MealSlotDto)
  mealSlots?: MealSlotDto[];

  @IsArray()
  @ArrayNotEmpty()
  @IsObject({ each: true })
  @ValidateNested({ each: true })
  @Type(() => DayTypeDto)
  dayTypes!: DayTypeDto[];

  @Order() trainingDayTypeOrder!: number;
  @Order() restDayTypeOrder!: number;
}
