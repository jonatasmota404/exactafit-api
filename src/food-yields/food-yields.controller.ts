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
import { CreateFoodYieldDto } from './dto/create-food-yield.dto';
import { UpdateFoodYieldDto } from './dto/update-food-yield.dto';
import { FoodYieldsService } from './food-yields.service';

interface AuthenticatedRequest extends Request {
  user: { sub: string; email?: string };
}

@UseGuards(AuthGuard)
@Controller('food-yields')
export class FoodYieldsController {
  constructor(private readonly service: FoodYieldsService) {}

  @Post()
  create(@Req() req: AuthenticatedRequest, @Body() dto: CreateFoodYieldDto) {
    return this.service.create(req.user.sub, dto);
  }

  @Get()
  findAll(@Req() req: AuthenticatedRequest) {
    return this.service.findAll(req.user.sub);
  }

  @Get(':id')
  findOne(
    @Req() req: AuthenticatedRequest,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    return this.service.findOne(req.user.sub, id);
  }

  @Patch(':id')
  update(
    @Req() req: AuthenticatedRequest,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateFoodYieldDto,
  ) {
    return this.service.update(req.user.sub, id, dto);
  }

  @Delete(':id')
  @HttpCode(204)
  async remove(
    @Req() req: AuthenticatedRequest,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    await this.service.remove(req.user.sub, id);
  }
}
