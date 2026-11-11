import { Module } from '@nestjs/common';
import { FoodsController } from './foods.controller';
import { FoodsService } from './foods.service';

@Module({
  providers: [FoodsService],
  controllers: [FoodsController],
})
export class FoodsModule {}
