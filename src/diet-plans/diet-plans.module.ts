import { Module } from '@nestjs/common';
import { DietPlansController } from './diet-plans.controller';
import { DietPlansService } from './diet-plans.service';

@Module({
  providers: [DietPlansService],
  controllers: [DietPlansController],
})
export class DietPlansModule {}
