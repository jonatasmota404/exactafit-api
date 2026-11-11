import { FoodState, FoodTag } from '@prisma/client';
import { Transform } from 'class-transformer';
import {
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';
import { NO_NUL } from '../../programs/dto/create-program.dto';

// search e state repetidos chegam como array e falham IsString/IsEnum (400).
export class ListFoodsQueryDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  @Matches(NO_NUL, { message: 'search não aceita byte nulo' })
  search?: string;

  @IsOptional()
  @IsEnum(FoodState)
  state?: FoodState;

  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    value === undefined || Array.isArray(value) ? value : [value],
  )
  @IsEnum(FoodTag, { each: true })
  tag?: FoodTag[];
}
