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
  type ValidationOptions,
  registerDecorator,
} from 'class-validator';
import { NO_NUL } from '../../programs/dto/create-program.dto';

// Até 1 casa decimal, sem multiplicar em float para decidir (10.25 recusa, 12.3 passa).
export function OneDecimal(options?: ValidationOptions) {
  return (target: object, propertyName: string) =>
    registerDecorator({
      name: 'oneDecimal',
      target: target.constructor,
      propertyName,
      options: {
        message: `${propertyName} aceita no máximo 1 casa decimal`,
        ...options,
      },
      validator: {
        validate: (v: unknown) =>
          typeof v === 'number' &&
          Number.isFinite(v) &&
          Math.abs(v * 10 - Math.round(v * 10)) < 1e-9,
      },
    });
}

export class CreateFoodDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  @Matches(NO_NUL, { message: 'name não aceita byte nulo' })
  name!: string;

  @IsEnum(FoodState)
  state!: FoodState;

  @IsNumber({ allowNaN: false, allowInfinity: false })
  @OneDecimal()
  @Min(0)
  @Max(900)
  kcal!: number;

  @IsNumber({ allowNaN: false, allowInfinity: false })
  @OneDecimal()
  @Min(0)
  @Max(100)
  proteinG!: number;

  @IsNumber({ allowNaN: false, allowInfinity: false })
  @OneDecimal()
  @Min(0)
  @Max(100)
  carbsG!: number;

  @IsNumber({ allowNaN: false, allowInfinity: false })
  @OneDecimal()
  @Min(0)
  @Max(100)
  fatG!: number;

  @ValidateIf((_, v) => v !== undefined && v !== null)
  @IsNumber({ allowNaN: false, allowInfinity: false })
  @OneDecimal()
  @Min(0)
  @Max(100)
  fiberG?: number | null;

  @ValidateIf((_, v) => v !== undefined)
  @IsArray()
  @IsEnum(FoodTag, { each: true })
  @ArrayUnique()
  tags?: FoodTag[];
}
