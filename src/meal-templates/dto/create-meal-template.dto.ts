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
  ValidateIf,
  ValidateNested,
  registerDecorator,
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

export class ItemDto {
  @IsUUID()
  foodId!: string;

  @IsNumber({ allowNaN: false, allowInfinity: false })
  @OneDecimal()
  @Min(0)
  @Max(99999.9)
  grams!: number;
}

// Lista exigida só para um `kind` e recusada no outro (COMPONENTS x FREE).
const ListFor = (kind: 'COMPONENTS' | 'FREE', prop: string) =>
  applyDecorators(
    ValidateIf(
      (o: Record<string, unknown>) => o.kind === kind || o[prop] !== undefined,
    ),
    (target: object, key: string) =>
      registerDecorator({
        name: 'listFor',
        target: target.constructor,
        propertyName: key,
        options: {
          message: `${prop} não é aceito para o kind informado`,
        },
        validator: {
          validate: (_: unknown, args) =>
            (args?.object as { kind?: string }).kind === kind,
        },
      }),
    IsArray(),
    ArrayNotEmpty(),
    IsObject({ each: true }),
  );

export class CreateMealTemplateDto {
  @IsUUID()
  mealSlotId!: string;

  @Name() name!: string;

  @IsInt()
  @Min(0)
  @Max(INT4_MAX)
  order!: number;

  @IsIn(['COMPONENTS', 'FREE'])
  kind!: 'COMPONENTS' | 'FREE';

  @ListFor('COMPONENTS', 'components')
  @ValidateNested({ each: true })
  @Type(() => ComponentDto)
  components?: ComponentDto[];

  @ListFor('FREE', 'items')
  @ValidateNested({ each: true })
  @Type(() => ItemDto)
  items?: ItemDto[];
}
