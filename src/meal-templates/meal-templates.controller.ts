import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { AuthGuard } from '../auth/auth.guard';
import { CreateMealTemplateDto } from './dto/create-meal-template.dto';
import { MealTemplatesService } from './meal-templates.service';

interface AuthenticatedRequest extends Request {
  user: { sub: string; email?: string };
}

@UseGuards(AuthGuard)
@Controller('diet-plans/:planId/meal-templates')
export class MealTemplatesController {
  constructor(private readonly service: MealTemplatesService) {}

  @Post()
  create(
    @Req() req: AuthenticatedRequest,
    @Param('planId', new ParseUUIDPipe()) planId: string,
    @Body() dto: CreateMealTemplateDto,
  ) {
    return this.service.create(req.user.sub, planId, dto);
  }

  @Get()
  findAll(
    @Req() req: AuthenticatedRequest,
    @Param('planId', new ParseUUIDPipe()) planId: string,
  ) {
    return this.service.findAll(req.user.sub, planId);
  }

  @Get(':id')
  findOne(
    @Req() req: AuthenticatedRequest,
    @Param('planId', new ParseUUIDPipe()) planId: string,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    return this.service.findOne(req.user.sub, planId, id);
  }

  @Put(':id')
  update(
    @Req() req: AuthenticatedRequest,
    @Param('planId', new ParseUUIDPipe()) planId: string,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: CreateMealTemplateDto,
  ) {
    return this.service.update(req.user.sub, planId, id, dto);
  }

  @Delete(':id')
  @HttpCode(204)
  async remove(
    @Req() req: AuthenticatedRequest,
    @Param('planId', new ParseUUIDPipe()) planId: string,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    await this.service.remove(req.user.sub, planId, id);
  }
}
