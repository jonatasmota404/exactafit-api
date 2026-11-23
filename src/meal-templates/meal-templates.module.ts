import { Module } from '@nestjs/common';
import { MealTemplatesController } from './meal-templates.controller';
import { MealTemplatesService } from './meal-templates.service';

@Module({
  providers: [MealTemplatesService],
  controllers: [MealTemplatesController],
})
export class MealTemplatesModule {}
