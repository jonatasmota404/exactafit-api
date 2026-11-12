import { Module } from '@nestjs/common';
import { FoodYieldsController } from './food-yields.controller';
import { FoodYieldsService } from './food-yields.service';

@Module({
  providers: [FoodYieldsService],
  controllers: [FoodYieldsController],
})
export class FoodYieldsModule {}
