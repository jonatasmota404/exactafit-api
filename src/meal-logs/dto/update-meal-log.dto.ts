import { OmitType } from '@nestjs/mapped-types';
import { CreateMealLogDto } from './create-meal-log.dto';

export class UpdateMealLogDto extends OmitType(CreateMealLogDto, ['id']) {}
