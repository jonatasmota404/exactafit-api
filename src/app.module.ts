import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { ExercisesModule } from './exercises/exercises.module';

@Module({
  imports: [PrismaModule, ExercisesModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
