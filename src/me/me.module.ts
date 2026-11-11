import { Module } from '@nestjs/common';
import { MeController } from './me.controller';
import { MeService } from './me.service';

@Module({
  providers: [MeService],
  controllers: [MeController],
})
export class MeModule {}
