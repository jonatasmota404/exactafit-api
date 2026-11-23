import { applyDecorators } from '@nestjs/common';
import { Type } from 'class-transformer';
import {
  ArrayNotEmpty,
  IsArray,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsObject,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { OneDecimal } from '../../foods/dto/create-food.dto';
import { NO_NUL } from '../../programs/dto/create-program.dto';
import { INT4_MAX } from '../../sessions/dto/create-set.dto';

export const TARGET_TYPES = ['KCAL', 'PROTEIN', 'CARBS', 'WEIGHT'] as const;

const Name = () =>
  applyDecorators(
    IsString(),
    IsNotEmpty(),
    MaxLength(100),
    Matches(NO_NUL, { message: 'name não aceita byte nulo' }),
  );

export class ComponentDto {
  @Name() name!: string;

  @IsIn(TARGET_TYPES)
  targetType!: (typeof TARGET_TYPES)[number];

  @IsNumber({ allowNaN: false, allowInfinity: false })
  @OneDecimal()
  @Min(0)
  @Max(99999.9)
  targetValue!: number;

  @IsArray()
  @ArrayNotEmpty()
  @IsUUID('all', { each: true })
  foodIds!: string[];
}

// Na 11b-1 só COMPONENTS; `items` (FREE) entra na 11b-2 e hoje cai na whitelist (400).
export class CreateMealTemplateDto {
  @IsUUID()
  mealSlotId!: string;

  @Name() name!: string;

  @IsInt()
  @Min(0)
  @Max(INT4_MAX)
  order!: number;

  @IsIn(['COMPONENTS'])
  kind!: 'COMPONENTS';

  @IsArray()
  @ArrayNotEmpty()
  @IsObject({ each: true })
  @ValidateNested({ each: true })
  @Type(() => ComponentDto)
  components!: ComponentDto[];
}
