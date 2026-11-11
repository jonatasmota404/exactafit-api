import { Module } from '@nestjs/common';
import { ProgramsController } from './programs.controller';
import { ProgramsService } from './programs.service';

@Module({
  providers: [ProgramsService],
  controllers: [ProgramsController],
})
export class ProgramsModule {}
