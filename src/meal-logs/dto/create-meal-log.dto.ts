import { Type } from 'class-transformer';
import {
  ArrayNotEmpty,
  IsArray,
  IsISO8601,
  IsOptional,
  IsUUID,
  Matches,
  ValidateNested,
} from 'class-validator';
import { ItemDto } from '../../meal-templates/dto/create-meal-template.dto';
import {
  AnoUtcAte9999,
  ISO_COM_FUSO,
} from '../../sessions/dto/create-session.dto';

export class CreateMealLogDto {
  @IsUUID()
  id!: string;

  @IsISO8601({ strict: true, strictSeparator: true })
  @Matches(ISO_COM_FUSO, {
    message: 'eatenAt deve ser ISO 8601 com fuso (Z ou ±hh:mm)',
  })
  @AnoUtcAte9999()
  eatenAt!: string;

  @IsOptional()
  @IsUUID()
  mealSlotId?: string;

  @IsOptional()
  @IsUUID()
  mealTemplateId?: string;

  @IsArray()
  @ArrayNotEmpty()
  @ValidateNested({ each: true })
  @Type(() => ItemDto)
  items!: ItemDto[];
}
