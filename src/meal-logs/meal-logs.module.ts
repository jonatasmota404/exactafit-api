import { Module } from '@nestjs/common';
import { MealLogsController } from './meal-logs.controller';
import { MealLogsService } from './meal-logs.service';

@Module({
  providers: [MealLogsService],
  controllers: [MealLogsController],
})
export class MealLogsModule {}
