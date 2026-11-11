import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { ExercisesModule } from './exercises/exercises.module';
import { AuthModule } from './auth/auth.module';
import { WorkoutsModule } from './workouts/workouts.module';
import { SessionsModule } from './sessions/sessions.module';
import { ProgramsModule } from './programs/programs.module';
import { MeModule } from './me/me.module';
import { FoodsModule } from './foods/foods.module';

@Module({
  imports: [
    PrismaModule,
    ExercisesModule,
    AuthModule,
    WorkoutsModule,
    SessionsModule,
    ProgramsModule,
    MeModule,
    FoodsModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
