import { randomUUID } from 'node:crypto';
import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { FoodState, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateMealTemplateDto } from './dto/create-meal-template.dto';

const PLAN_NOT_FOUND = 'Plano de dieta não encontrado';
const NOT_FOUND = 'Refeição modelo não encontrada';
const FOOD_NOT_FOUND = 'Alimento não encontrado';
const ORDER_TAKEN = 'order já usado por outra refeição modelo desta refeição';

type Tx = Prisma.TransactionClient;
type FoodRow = {
  id: string;
  name: string;
  state: FoodState;
  kcal: Prisma.Decimal;
  protein_g: Prisma.Decimal;
  carbs_g: Prisma.Decimal;
};

// Meta que exige o nutriente no alimento (M7); WEIGHT aceita qualquer um.
const NUTRIENT = {
  KCAL: 'kcal',
  PROTEIN: 'protein_g',
  CARBS: 'carbs_g',
} as const;

// Sem userId: o dono nunca sai na resposta.
const full = {
  components: {
    orderBy: { position: 'asc' },
    include: {
      options: {
        orderBy: { position: 'asc' },
        include: { food: { select: { name: true, state: true } } },
      },
    },
  },
} satisfies Prisma.MealTemplateInclude;
type Row = Prisma.MealTemplateGetPayload<{ include: typeof full }>;

const out = (t: Row) => ({
  id: t.id,
  mealSlotId: t.mealSlotId,
  name: t.name,
  order: t.order,
  kind: t.kind,
  components: t.components.map((c) => ({
    id: c.id,
    name: c.name,
    targetType: c.targetType,
    targetValue: c.targetValue,
    options: c.options.map((o) => ({
      foodId: o.foodId,
      name: o.food.name,
      state: o.food.state,
    })),
  })),
  items: [],
  totals: null,
  createdAt: t.createdAt,
  updatedAt: t.updatedAt,
});

@Injectable()
export class MealTemplatesService {
  constructor(private readonly prisma: PrismaService) {}

  // Trava a linha do plano: PATCH/DELETE do plano e as rotas daqui se serializam.
  private async lockPlan(tx: Tx, userId: string, planId: string) {
    const rows = await tx.$queryRaw<
      unknown[]
    >`SELECT 1 FROM diet_plans WHERE id = ${planId} AND user_id = ${userId} FOR UPDATE`;
    if (rows.length === 0) throw new NotFoundException(PLAN_NOT_FOUND);
  }

  async create(userId: string, planId: string, dto: CreateMealTemplateDto) {
    try {
      return await this.prisma.$transaction(async (tx) => {
        await this.lockPlan(tx, userId, planId);
        const slot = await tx.mealSlot.findFirst({
          where: { id: dto.mealSlotId, dietPlanId: planId },
          select: { id: true },
        });
        if (!slot) {
          throw new BadRequestException('Refeição não pertence ao plano');
        }
        const taken = await tx.mealTemplate.findFirst({
          where: { mealSlotId: slot.id, order: dto.order },
          select: { id: true },
        });
        if (taken) throw new BadRequestException(ORDER_TAKEN);

        for (const c of dto.components) {
          if (new Set(c.foodIds).size !== c.foodIds.length) {
            throw new BadRequestException('Alimento repetido');
          }
        }
        const foodIds = [...new Set(dto.components.flatMap((c) => c.foodIds))];
        // Uma só consulta ordenada por id (sem deadlock); FOR SHARE conflita com o
        // FOR UPDATE do DELETE /foods.
        const foods = await tx.$queryRaw<FoodRow[]>`
          SELECT id, name, state, kcal, protein_g, carbs_g FROM foods
          WHERE id IN (${Prisma.join(foodIds)})
            AND (user_id = ${userId} OR user_id IS NULL)
          ORDER BY id FOR SHARE`;
        const byId = new Map(foods.map((f) => [f.id, f]));
        if (byId.size !== foodIds.length) {
          throw new NotFoundException(FOOD_NOT_FOUND);
        }
        for (const c of dto.components) {
          if (c.targetType === 'WEIGHT') continue;
          const col = NUTRIENT[c.targetType];
          for (const id of c.foodIds) {
            const f = byId.get(id)!;
            if (Number(f[col]) === 0) {
              throw new BadRequestException(
                `Alimento sem o nutriente da meta: ${f.name}`,
              );
            }
          }
        }

        // Ids gerados aqui e createMany por tabela: uma query por item estourava o
        // timeout da transação (#50).
        const templateId = randomUUID();
        const comps = dto.components.map((c) => ({ ...c, id: randomUUID() }));
        await tx.mealTemplate.create({
          data: {
            id: templateId,
            mealSlotId: slot.id,
            name: dto.name,
            order: dto.order,
            kind: dto.kind,
          },
        });
        await tx.mealTemplateComponent.createMany({
          data: comps.map((c, position) => ({
            id: c.id,
            mealTemplateId: templateId,
            position,
            name: c.name,
            targetType: c.targetType,
            targetValue: c.targetValue,
          })),
        });
        await tx.mealTemplateOption.createMany({
          data: comps.flatMap((c) =>
            c.foodIds.map((foodId, position) => ({
              componentId: c.id,
              foodId,
              position,
            })),
          ),
        });
        const created = await tx.mealTemplate.findUniqueOrThrow({
          where: { id: templateId },
          include: full,
        });
        return out(created);
      });
    } catch (e) {
      // Dois POST com o mesmo order ao mesmo tempo: o índice único barra o segundo.
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === 'P2002'
      ) {
        throw new BadRequestException(ORDER_TAKEN);
      }
      throw e;
    }
  }

  private async assertPlan(userId: string, planId: string) {
    const plan = await this.prisma.dietPlan.findFirst({
      where: { id: planId, userId },
      select: { id: true },
    });
    if (!plan) throw new NotFoundException(PLAN_NOT_FOUND);
  }

  async findAll(userId: string, planId: string) {
    await this.assertPlan(userId, planId);
    const rows = await this.prisma.mealTemplate.findMany({
      where: { mealSlot: { dietPlanId: planId } },
      orderBy: [
        { mealSlot: { order: 'asc' } },
        { order: 'asc' },
        { id: 'asc' },
      ],
      include: full,
    });
    return rows.map(out);
  }

  async findOne(userId: string, planId: string, id: string) {
    await this.assertPlan(userId, planId);
    const row = await this.prisma.mealTemplate.findFirst({
      where: { id, mealSlot: { dietPlanId: planId } },
      include: full,
    });
    if (!row) throw new NotFoundException(NOT_FOUND);
    return out(row);
  }

  async remove(userId: string, planId: string, id: string) {
    await this.prisma.$transaction(async (tx) => {
      await this.lockPlan(tx, userId, planId);
      const { count } = await tx.mealTemplate.deleteMany({
        where: { id, mealSlot: { dietPlanId: planId } },
      });
      if (count === 0) throw new NotFoundException(NOT_FOUND);
    });
  }
}
