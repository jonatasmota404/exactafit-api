import { Module } from '@nestjs/common';
import { MealLogsModule } from '../meal-logs/meal-logs.module';
import { TodayController } from './today.controller';
import { TodayService } from './today.service';

@Module({
  imports: [MealLogsModule],
  providers: [TodayService],
  controllers: [TodayController],
})
export class TodayModule {}
