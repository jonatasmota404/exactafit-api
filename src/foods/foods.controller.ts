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
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { AuthGuard } from '../auth/auth.guard';
import { CreateFoodDto } from './dto/create-food.dto';
import { ListFoodsQueryDto } from './dto/list-foods-query.dto';
import { UpdateFoodDto } from './dto/update-food.dto';
import { FoodsService } from './foods.service';

interface AuthenticatedRequest extends Request {
  user: { sub: string; email?: string };
}

@UseGuards(AuthGuard)
@Controller('foods')
export class FoodsController {
  constructor(private readonly foodsService: FoodsService) {}

  @Post()
  create(@Req() req: AuthenticatedRequest, @Body() dto: CreateFoodDto) {
    return this.foodsService.create(req.user.sub, dto);
  }

  @Get()
  findAll(@Req() req: AuthenticatedRequest, @Query() query: ListFoodsQueryDto) {
    return this.foodsService.findAll(req.user.sub, query);
  }

  @Get(':id')
  findOne(
    @Req() req: AuthenticatedRequest,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    return this.foodsService.findOne(req.user.sub, id);
  }

  @Patch(':id')
  update(
    @Req() req: AuthenticatedRequest,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateFoodDto,
  ) {
    return this.foodsService.update(req.user.sub, id, dto);
  }

  @Delete(':id')
  @HttpCode(204)
  async remove(
    @Req() req: AuthenticatedRequest,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    await this.foodsService.remove(req.user.sub, id);
  }
}
