import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateFoodDto } from './dto/create-food.dto';
import { ListFoodsQueryDto } from './dto/list-foods-query.dto';
import { UpdateFoodDto } from './dto/update-food.dto';

const NOT_FOUND = 'Alimento não encontrado';
const CATALOG_LOCKED = 'Alimento do catálogo não pode ser alterado';

// Sem userId: o dono nunca sai na resposta.
const publicFields = {
  id: true,
  name: true,
  state: true,
  kcal: true,
  proteinG: true,
  carbsG: true,
  fatG: true,
  fiberG: true,
  tags: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.FoodSelect;

// A3: soma em décimos inteiros, sem erro de ponto flutuante.
const tenths = (v: number | Prisma.Decimal | null | undefined) =>
  v === null || v === undefined ? 0 : Math.round(Number(v) * 10);

function assertSum(p: number, c: number, f: number, fiber: number | null) {
  if (tenths(p) + tenths(c) + tenths(f) + tenths(fiber) > 1000) {
    throw new BadRequestException(
      'proteinG + carbsG + fatG + fiberG não pode passar de 100',
    );
  }
}

@Injectable()
export class FoodsService {
  constructor(private readonly prisma: PrismaService) {}

  create(userId: string, dto: CreateFoodDto) {
    assertSum(dto.proteinG, dto.carbsG, dto.fatG, dto.fiberG ?? null);
    return this.prisma.food.create({
      data: {
        userId,
        name: dto.name,
        state: dto.state,
        kcal: dto.kcal,
        proteinG: dto.proteinG,
        carbsG: dto.carbsG,
        fatG: dto.fatG,
        fiberG: dto.fiberG ?? null,
        tags: dto.tags ?? [],
      },
      select: publicFields,
    });
  }

  findAll(userId: string, query: ListFoodsQueryDto) {
    return this.prisma.food.findMany({
      where: {
        OR: [{ userId: null }, { userId }],
        ...(query.search !== undefined && {
          // A4: o contains do Prisma não escapa o LIKE; \, % e _ viram texto.
          name: {
            contains: query.search.replace(/[\\%_]/g, '\\$&'),
            mode: 'insensitive',
          },
        }),
        ...(query.state !== undefined && { state: query.state }),
        ...(query.tag !== undefined && { tags: { hasEvery: query.tag } }),
      },
      orderBy: [{ name: 'asc' }, { id: 'asc' }],
      select: publicFields,
    });
  }

  async findOne(userId: string, id: string) {
    const food = await this.prisma.food.findFirst({
      where: { id, OR: [{ userId: null }, { userId }] },
      select: publicFields,
    });
    if (!food) throw new NotFoundException(NOT_FOUND);
    return food;
  }

  async update(userId: string, id: string, dto: UpdateFoodDto) {
    return this.prisma.$transaction(async (tx) => {
      const rows = await tx.$queryRaw<
        {
          user_id: string | null;
          protein_g: Prisma.Decimal;
          carbs_g: Prisma.Decimal;
          fat_g: Prisma.Decimal;
          fiber_g: Prisma.Decimal | null;
        }[]
      >`SELECT user_id, protein_g, carbs_g, fat_g, fiber_g FROM foods WHERE id = ${id} AND (user_id = ${userId} OR user_id IS NULL) FOR UPDATE`;
      if (rows.length === 0) throw new NotFoundException(NOT_FOUND);
      const row = rows[0];
      if (row.user_id === null) throw new ForbiddenException(CATALOG_LOCKED);
      assertSum(
        dto.proteinG ?? Number(row.protein_g),
        dto.carbsG ?? Number(row.carbs_g),
        dto.fatG ?? Number(row.fat_g),
        dto.fiberG === undefined
          ? row.fiber_g === null
            ? null
            : Number(row.fiber_g)
          : dto.fiberG,
      );
      return tx.food.update({
        where: { id },
        data: {
          name: dto.name,
          state: dto.state,
          kcal: dto.kcal,
          proteinG: dto.proteinG,
          carbsG: dto.carbsG,
          fatG: dto.fatG,
          fiberG: dto.fiberG,
          tags: dto.tags,
        },
        select: publicFields,
      });
    });
  }

  async remove(userId: string, id: string) {
    const food = await this.prisma.food.findFirst({
      where: { id, OR: [{ userId: null }, { userId }] },
      select: { userId: true },
    });
    if (!food) throw new NotFoundException(NOT_FOUND);
    if (food.userId === null) throw new ForbiddenException(CATALOG_LOCKED);
    await this.prisma.food.deleteMany({ where: { id, userId } });
  }
}
