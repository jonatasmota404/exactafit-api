import { randomUUID } from 'node:crypto';
import {
  BadRequestException,
  ConflictException,
  GoneException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { FoodState, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateMealLogDto } from './dto/create-meal-log.dto';
import { UpdateMealLogDto } from './dto/update-meal-log.dto';
import { dayBounds } from './day-bounds';

const EXISTS = 'Registro de refeição já existe';
const GONE = 'Registro de refeição apagado';
const NOT_FOUND = 'Registro de refeição não encontrado';
const SLOT_NOT_FOUND = 'Refeição não encontrada';
const TEMPLATE_NOT_IN_SLOT = 'Refeição modelo não pertence à refeição';
const FOOD_NOT_FOUND = 'Alimento não encontrado';

type Tx = Prisma.TransactionClient;
type FoodRow = {
  id: string;
  name: string;
  state: FoodState;
  kcal: Prisma.Decimal;
  protein_g: Prisma.Decimal;
  carbs_g: Prisma.Decimal;
  fat_g: Prisma.Decimal;
  fiber_g: Prisma.Decimal | null;
};

const withItems = {
  items: { orderBy: { position: 'asc' } },
} satisfies Prisma.MealLogInclude;
type Row = Prisma.MealLogGetPayload<{ include: typeof withItems }>;

// valor por 100 g × gramas ÷ 100 em décimos inteiros, meio para cima (sem ponto flutuante).
const tenths = (d: Prisma.Decimal) => d.mul(10).toNumber();
const snap = (per100: Prisma.Decimal, grams10: number) =>
  new Prisma.Decimal(Math.floor((tenths(per100) * grams10 + 500) / 1000)).div(
    10,
  );

// Soma dos snapshots já arredondados; null se nenhum item tem o valor.
const sum = (vals: (Prisma.Decimal | null)[]) => {
  const v = vals.filter((x) => x !== null);
  return v.length === 0 ? null : Prisma.Decimal.sum(...v).toString();
};

const out = (l: Row) => ({
  id: l.id,
  eatenAt: l.eatenAt,
  mealSlotId: l.mealSlotId,
  mealSlotName: l.mealSlotName,
  mealTemplateId: l.mealTemplateId,
  items: l.items.map((i) => ({
    foodId: i.foodId,
    name: i.foodName,
    state: i.foodState,
    grams: i.grams,
    kcal: i.kcal,
    proteinG: i.proteinG,
    carbsG: i.carbsG,
    fatG: i.fatG,
    fiberG: i.fiberG,
  })),
  totals: {
    kcal: sum(l.items.map((i) => i.kcal)),
    proteinG: sum(l.items.map((i) => i.proteinG)),
    carbsG: sum(l.items.map((i) => i.carbsG)),
    fatG: sum(l.items.map((i) => i.fatG)),
    fiberG: sum(l.items.map((i) => i.fiberG)),
  },
  createdAt: l.createdAt,
  updatedAt: l.updatedAt,
});

@Injectable()
export class MealLogsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(userId: string, dto: CreateMealLogDto) {
    // UUID vale em qualquer caixa; grava e busca sempre em minúsculas.
    const id = dto.id.toLowerCase();
    const { slotId, templateId, items } = this.normalize(dto);

    const existing = await this.load(id);
    if (existing) return this.reenvio(userId, existing);

    try {
      const log = await this.prisma.$transaction((tx) =>
        this.insert(tx, userId, id, dto.eatenAt, slotId, templateId, items),
      );
      return { created: true, log: out(log) };
    } catch (e) {
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === 'P2002'
      ) {
        // Dois envios do mesmo id: a transação abortou; relê fora dela.
        const winner = await this.load(id);
        if (winner) return this.reenvio(userId, winner);
      }
      throw e;
    }
  }

  // Estado completo: refeição, refeição modelo e alimentos (FOR SHARE) antes do registro
  // (FOR UPDATE): travar o registro antes daria deadlock com o PATCH do plano.
  async replace(userId: string, rawId: string, dto: UpdateMealLogDto) {
    const id = rawId.toLowerCase();
    const { slotId, templateId, items } = this.normalize(dto);
    const log = await this.prisma.$transaction(async (tx) => {
      const refs = await this.lockRefs(tx, userId, slotId, templateId, items);
      const rows = await tx.$queryRaw<unknown[]>`
        SELECT 1 FROM meal_logs
        WHERE id = ${id} AND user_id = ${userId} AND deleted_at IS NULL
        FOR UPDATE`;
      if (rows.length === 0) throw new NotFoundException(NOT_FOUND);
      await tx.mealLog.update({
        where: { id },
        data: {
          eatenAt: new Date(dto.eatenAt),
          mealSlotId: slotId ?? null,
          mealSlotName: refs.slotName,
          mealTemplateId: templateId ?? null,
        },
      });
      await tx.mealLogItem.deleteMany({ where: { mealLogId: id } });
      await tx.mealLogItem.createMany({
        data: this.itemRows(id, items, refs.byId),
      });
      return tx.mealLog.findUniqueOrThrow({
        where: { id },
        include: withItems,
      });
    });
    return out(log);
  }

  async remove(userId: string, id: string) {
    const { count } = await this.prisma.mealLog.updateMany({
      where: { id: id.toLowerCase(), userId, deletedAt: null },
      data: { deletedAt: new Date() },
    });
    if (count === 0) throw new NotFoundException(NOT_FOUND);
  }

  async findOne(userId: string, id: string) {
    const log = await this.prisma.mealLog.findFirst({
      where: { id: id.toLowerCase(), userId, deletedAt: null },
      include: withItems,
    });
    if (!log) throw new NotFoundException(NOT_FOUND);
    return out(log);
  }

  async list(userId: string, date: string) {
    const { timezone } = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { timezone: true },
    });
    const { start, end } = dayBounds(date, timezone);
    const logs = await this.prisma.mealLog.findMany({
      where: { userId, deletedAt: null, eatenAt: { gte: start, lt: end } },
      orderBy: [{ eatenAt: 'asc' }, { id: 'asc' }],
      include: withItems,
    });
    return logs.map(out);
  }

  private load(id: string) {
    return this.prisma.mealLog.findUnique({
      where: { id },
      include: withItems,
    });
  }

  private reenvio(userId: string, log: Row) {
    if (log.userId !== userId) throw new ConflictException(EXISTS);
    if (log.deletedAt) throw new GoneException(GONE);
    return { created: false, log: out(log) };
  }

  private normalize(dto: UpdateMealLogDto) {
    const items = dto.items.map((i) => ({
      foodId: i.foodId.toLowerCase(),
      grams: i.grams,
    }));
    const foodIds = items.map((i) => i.foodId);
    if (new Set(foodIds).size !== foodIds.length) {
      throw new BadRequestException('Alimento repetido');
    }
    return {
      slotId: dto.mealSlotId?.toLowerCase(),
      templateId: dto.mealTemplateId?.toLowerCase(),
      items,
    };
  }

  private async insert(
    tx: Tx,
    userId: string,
    id: string,
    eatenAt: string,
    slotId: string | undefined,
    templateId: string | undefined,
    items: { foodId: string; grams: number }[],
  ) {
    const { slotName, byId } = await this.lockRefs(
      tx,
      userId,
      slotId,
      templateId,
      items,
    );
    await tx.mealLog.create({
      data: {
        id,
        userId,
        eatenAt: new Date(eatenAt),
        mealSlotId: slotId ?? null,
        mealSlotName: slotName,
        mealTemplateId: templateId ?? null,
      },
    });
    // createMany: uma query por item estourava o timeout da transação (#50).
    await tx.mealLogItem.createMany({ data: this.itemRows(id, items, byId) });
    return tx.mealLog.findUniqueOrThrow({ where: { id }, include: withItems });
  }

  // Travas na ordem: refeição, refeição modelo, alimentos por id. Sem travar o plano
  // (deadlock com o PATCH do plano). FOR SHARE conflita com o DELETE da linha.
  private async lockRefs(
    tx: Tx,
    userId: string,
    slotId: string | undefined,
    templateId: string | undefined,
    items: { foodId: string; grams: number }[],
  ) {
    let slotName: string | null = null;
    if (slotId) {
      const slots = await tx.$queryRaw<{ name: string }[]>`
        SELECT ms.name FROM meal_slots ms
        JOIN diet_plans dp ON dp.id = ms.diet_plan_id
        WHERE ms.id = ${slotId} AND dp.user_id = ${userId}
        FOR SHARE OF ms`;
      if (slots.length === 0) throw new BadRequestException(SLOT_NOT_FOUND);
      slotName = slots[0].name;
    }
    if (templateId) {
      const templates = slotId
        ? await tx.$queryRaw<unknown[]>`
            SELECT 1 FROM meal_templates
            WHERE id = ${templateId} AND meal_slot_id = ${slotId} FOR SHARE`
        : [];
      if (templates.length === 0) {
        throw new BadRequestException(TEMPLATE_NOT_IN_SLOT);
      }
    }

    const foodIds = items.map((i) => i.foodId);
    const foods = await tx.$queryRaw<FoodRow[]>`
      SELECT id, name, state, kcal, protein_g, carbs_g, fat_g, fiber_g FROM foods
      WHERE id IN (${Prisma.join(foodIds)})
        AND (user_id = ${userId} OR user_id IS NULL)
      ORDER BY id FOR SHARE`;
    const byId = new Map(foods.map((f) => [f.id, f]));
    if (byId.size !== foodIds.length)
      throw new NotFoundException(FOOD_NOT_FOUND);

    return { slotName, byId };
  }

  private itemRows(
    mealLogId: string,
    items: { foodId: string; grams: number }[],
    byId: Map<string, FoodRow>,
  ) {
    return items.map((it, position) => {
      const f = byId.get(it.foodId)!;
      const g10 = Math.round(it.grams * 10);
      return {
        id: randomUUID(),
        mealLogId,
        foodId: f.id,
        position,
        foodName: f.name,
        foodState: f.state,
        grams: new Prisma.Decimal(g10).div(10),
        kcal: snap(f.kcal, g10),
        proteinG: snap(f.protein_g, g10),
        carbsG: snap(f.carbs_g, g10),
        fatG: snap(f.fat_g, g10),
        fiberG: f.fiber_g && snap(f.fiber_g, g10),
      };
    });
  }
}
