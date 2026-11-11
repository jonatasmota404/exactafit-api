import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { AuthGuard } from '../auth/auth.guard';
import { CreateProgramDto } from './dto/create-program.dto';
import { UpdateProgramDto } from './dto/update-program.dto';
import { ProgramsService } from './programs.service';

interface AuthenticatedRequest extends Request {
  user: { sub: string; email?: string };
}

@UseGuards(AuthGuard)
@Controller('programs')
export class ProgramsController {
  constructor(private readonly programsService: ProgramsService) {}

  @Post()
  create(@Req() req: AuthenticatedRequest, @Body() dto: CreateProgramDto) {
    return this.programsService.create(req.user.sub, dto);
  }

  @Get()
  findAll(@Req() req: AuthenticatedRequest) {
    return this.programsService.findAll(req.user.sub);
  }

  @Get(':id')
  findOne(
    @Req() req: AuthenticatedRequest,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    return this.programsService.findOne(req.user.sub, id);
  }

  @Patch(':id')
  update(
    @Req() req: AuthenticatedRequest,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateProgramDto,
  ) {
    return this.programsService.update(req.user.sub, id, dto);
  }

  @Delete(':id')
  @HttpCode(204)
  async remove(
    @Req() req: AuthenticatedRequest,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    await this.programsService.remove(req.user.sub, id);
  }

  @Post(':id/activate')
  @HttpCode(200)
  activate(
    @Req() req: AuthenticatedRequest,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    return this.programsService.activate(req.user.sub, id);
  }

  @Post(':id/deactivate')
  @HttpCode(200)
  deactivate(
    @Req() req: AuthenticatedRequest,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    return this.programsService.deactivate(req.user.sub, id);
  }
}
