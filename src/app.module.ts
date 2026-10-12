import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { ExercisesModule } from './exercises/exercises.module';
import { AuthModule } from './auth/auth.module';
import { RoutineModule } from './routines/routine.module';
import { SessionsModule } from './sessions/sessions.module';

@Module({
  imports: [PrismaModule, ExercisesModule, AuthModule, RoutineModule, SessionsModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
