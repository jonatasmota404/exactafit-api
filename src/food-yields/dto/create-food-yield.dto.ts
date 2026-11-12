import { IsUUID } from 'class-validator';
import { UpdateFoodYieldDto } from './update-food-yield.dto';

export class CreateFoodYieldDto extends UpdateFoodYieldDto {
  @IsUUID()
  rawFoodId!: string;

  @IsUUID()
  cookedFoodId!: string;
}
