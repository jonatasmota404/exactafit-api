import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { FoodState, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateFoodYieldDto } from './dto/create-food-yield.dto';
import { UpdateFoodYieldDto } from './dto/update-food-yield.dto';

const FOOD_NOT_FOUND = 'Alimento não encontrado';
const NOT_FOUND = 'Rendimento não encontrado';
const DUPLICATE = 'Rendimento já existe para este par';

// Sem userId: o dono nunca sai na resposta.
const publicFields = {
  id: true,
  factor: true,
  rawFood: { select: { id: true, name: true } },
  cookedFood: { select: { id: true, name: true } },
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.FoodYieldSelect;

@Injectable()
export class FoodYieldsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(userId: string, dto: CreateFoodYieldDto) {
    const { rawFoodId, cookedFoodId, factor } = dto;
    try {
      return await this.prisma.$transaction(async (tx) => {
        // Uma só consulta, ordenada por id: dois POST com ids invertidos não dão deadlock.
        // FOR SHARE conflita com o FOR UPDATE do DELETE/PATCH de state em /foods.
        const rows = await tx.$queryRaw<{ id: string; state: FoodState }[]>`
          SELECT id, state FROM foods
          WHERE id IN (${Prisma.join([rawFoodId, cookedFoodId])})
            AND (user_id = ${userId} OR user_id IS NULL)
          ORDER BY id FOR SHARE`;
        const raw = rows.find((r) => r.id === rawFoodId);
        const cooked = rows.find((r) => r.id === cookedFoodId);
        if (!raw || !cooked) throw new NotFoundException(FOOD_NOT_FOUND);
        if (raw.state !== FoodState.RAW) {
          throw new BadRequestException(
            'rawFoodId precisa ser um alimento cru',
          );
        }
        if (cooked.state !== FoodState.COOKED) {
          throw new BadRequestException(
            'cookedFoodId precisa ser um alimento pronto',
          );
        }
        return tx.foodYield.create({
          data: { userId, rawFoodId, cookedFoodId, factor },
          select: publicFields,
        });
      });
    } catch (e) {
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === 'P2002'
      ) {
        throw new ConflictException(DUPLICATE);
      }
      throw e;
    }
  }

  findAll(userId: string) {
    return this.prisma.foodYield.findMany({
      where: { userId },
      orderBy: [
        { rawFood: { name: 'asc' } },
        { cookedFood: { name: 'asc' } },
        { id: 'asc' },
      ],
      select: publicFields,
    });
  }

  async findOne(userId: string, id: string) {
    const item = await this.prisma.foodYield.findFirst({
      where: { id, userId },
      select: publicFields,
    });
    if (!item) throw new NotFoundException(NOT_FOUND);
    return item;
  }

  async update(userId: string, id: string, dto: UpdateFoodYieldDto) {
    const { count } = await this.prisma.foodYield.updateMany({
      where: { id, userId },
      data: { factor: dto.factor },
    });
    if (count === 0) throw new NotFoundException(NOT_FOUND);
    return this.findOne(userId, id);
  }

  async remove(userId: string, id: string) {
    const { count } = await this.prisma.foodYield.deleteMany({
      where: { id, userId },
    });
    if (count === 0) throw new NotFoundException(NOT_FOUND);
  }
}
