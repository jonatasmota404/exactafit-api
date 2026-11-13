import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreateDietPlanDto,
  type DayTypeDto,
  UpdateDietPlanDto,
  VALUE_FIELDS,
  type TargetValuesDto,
} from './dto/create-diet-plan.dto';

const NOT_FOUND = 'Plano de dieta não encontrado';

const full = {
  mealSlots: { orderBy: { order: 'asc' } },
  dayTypes: {
    orderBy: { order: 'asc' },
    include: {
      mealTargets: { include: { mealSlot: { select: { order: true } } } },
    },
  },
} satisfies Prisma.DietPlanInclude;

type Tx = Prisma.TransactionClient;
type PlanRow = Prisma.DietPlanGetPayload<{ include: typeof full }>;

// Só os cinco valores, sem undefined (nulo e omitido equivalem, D3).
const values = (t: TargetValuesDto) =>
  Object.fromEntries(VALUE_FIELDS.map((f) => [f, t[f] ?? null])) as Record<
    (typeof VALUE_FIELDS)[number],
    number | null
  >;
type Values = ReturnType<typeof values>;
type TypeRow = Values & {
  name: string;
  order: number;
  trainingDay: boolean;
  restDay: boolean;
};
type TargetRow = Values & { dayTypeId: string; mealSlotId: string };
type Created = { id: string; order: number };

@Injectable()
export class DietPlansService {
  constructor(private readonly prisma: PrismaService) {}

  // Inserções em lote (POST e PATCH): um plano pode ter milhares de itens (D4) e a
  // transação tem timeout de 5 s; uma query por item estourava e virava 500.
  private async insertMealSlots(
    tx: Tx,
    planId: string,
    rows: { name: string; order: number }[],
  ) {
    if (rows.length === 0) return [];
    return tx.$queryRaw<Created[]>`
      INSERT INTO meal_slots (id, diet_plan_id, name, "order", updated_at)
      SELECT gen_random_uuid()::text, ${planId}, v.name, v."order", now()
      FROM unnest(${rows.map((r) => r.name)}::text[], ${rows.map((r) => r.order)}::int[])
        AS v(name, "order")
      RETURNING id, "order"`;
  }

  private async insertDayTypes(tx: Tx, planId: string, rows: TypeRow[]) {
    if (rows.length === 0) return [];
    const col = <K extends keyof TypeRow>(k: K) => rows.map((r) => r[k]);
    return tx.$queryRaw<Created[]>`
      INSERT INTO day_types (id, diet_plan_id, name, "order", training_day, rest_day,
        kcal, protein_g, carbs_g, fat_g, fiber_g, updated_at)
      SELECT gen_random_uuid()::text, ${planId}, v.name, v."order", v.training_day, v.rest_day,
        v.kcal, v.protein_g, v.carbs_g, v.fat_g, v.fiber_g, now()
      FROM unnest(${col('name')}::text[], ${col('order')}::int[], ${col('trainingDay')}::boolean[],
        ${col('restDay')}::boolean[], ${col('kcal')}::numeric[], ${col('proteinG')}::numeric[],
        ${col('carbsG')}::numeric[], ${col('fatG')}::numeric[], ${col('fiberG')}::numeric[])
        AS v(name, "order", training_day, rest_day, kcal, protein_g, carbs_g, fat_g, fiber_g)
      RETURNING id, "order"`;
  }

  private async insertMealTargets(tx: Tx, rows: TargetRow[]) {
    if (rows.length === 0) return;
    const col = <K extends keyof TargetRow>(k: K) => rows.map((r) => r[k]);
    await tx.$executeRaw`
      INSERT INTO meal_targets (id, day_type_id, meal_slot_id, kcal, protein_g, carbs_g, fat_g, fiber_g, updated_at)
      SELECT gen_random_uuid()::text, v.day_type_id, v.meal_slot_id,
        v.kcal, v.protein_g, v.carbs_g, v.fat_g, v.fiber_g, now()
      FROM unnest(${col('dayTypeId')}::text[], ${col('mealSlotId')}::text[], ${col('kcal')}::numeric[],
        ${col('proteinG')}::numeric[], ${col('carbsG')}::numeric[], ${col('fatG')}::numeric[], ${col('fiberG')}::numeric[])
        AS v(day_type_id, meal_slot_id, kcal, protein_g, carbs_g, fat_g, fiber_g)`;
  }

  private out(plan: PlanRow) {
    const { userId: _userId, mealSlots, dayTypes, ...rest } = plan;
    void _userId;
    return {
      id: rest.id,
      name: rest.name,
      active: rest.active,
      trainingDayTypeId: dayTypes.find((d) => d.trainingDay)?.id,
      restDayTypeId: dayTypes.find((d) => d.restDay)?.id,
      mealSlots: mealSlots.map((m) => ({
        id: m.id,
        name: m.name,
        order: m.order,
      })),
      dayTypes: dayTypes.map((d) => {
        const targets = [...d.mealTargets].sort(
          (a, b) => a.mealSlot.order - b.mealSlot.order,
        );
        const pick = (
          o: Record<(typeof VALUE_FIELDS)[number], Prisma.Decimal | null>,
        ) => Object.fromEntries(VALUE_FIELDS.map((f) => [f, o[f]]));
        return {
          id: d.id,
          name: d.name,
          order: d.order,
          ...pick(d),
          mealTargets: targets.map((t) => ({
            mealSlotId: t.mealSlotId,
            ...pick(t),
          })),
          mealTargetsSum: Object.fromEntries(
            VALUE_FIELDS.map((f) => {
              const has = targets.filter((t) => t[f] !== null);
              return [
                f,
                has.length
                  ? has.reduce((s, t) => s.add(t[f]!), new Prisma.Decimal(0))
                  : null,
              ];
            }),
          ),
        };
      }),
      createdAt: rest.createdAt,
      updatedAt: rest.updatedAt,
    };
  }

  private async load(tx: Tx | PrismaService, userId: string, id: string) {
    const plan = await tx.dietPlan.findFirst({
      where: { id, userId },
      include: full,
    });
    if (!plan) throw new NotFoundException(NOT_FOUND);
    return this.out(plan);
  }

  // Estrutura do plano (C3, C5): metas com algum valor, order único, referências existentes.
  private validate(dto: CreateDietPlanDto) {
    const slots = dto.mealSlots ?? [];
    const unique = (orders: number[], what: string) => {
      if (new Set(orders).size !== orders.length) {
        throw new BadRequestException(`order repetido entre ${what}`);
      }
    };
    unique(
      slots.map((s) => s.order),
      'refeições',
    );
    unique(
      dto.dayTypes.map((d) => d.order),
      'tipos de dia',
    );
    const slotOrders = new Set(slots.map((s) => s.order));
    const typeOrders = new Set(dto.dayTypes.map((d) => d.order));
    if (
      !typeOrders.has(dto.trainingDayTypeOrder) ||
      !typeOrders.has(dto.restDayTypeOrder)
    ) {
      throw new BadRequestException(
        'Tipo de dia de treino/descanso inexistente',
      );
    }
    const hasValue = (t: TargetValuesDto) =>
      VALUE_FIELDS.some((f) => t[f] !== undefined && t[f] !== null);
    for (const d of dto.dayTypes) {
      if (!hasValue(d)) {
        throw new BadRequestException('Meta do dia sem nenhum valor');
      }
      const targets = d.mealTargets ?? [];
      unique(
        targets.map((t) => t.mealSlotOrder),
        'metas de refeição do mesmo tipo',
      );
      for (const t of targets) {
        if (!slotOrders.has(t.mealSlotOrder)) {
          throw new BadRequestException('mealSlotOrder inexistente');
        }
        if (!hasValue(t)) {
          throw new BadRequestException('Meta da refeição sem nenhum valor');
        }
      }
    }
  }

  async create(userId: string, dto: CreateDietPlanDto) {
    this.validate(dto);
    return this.prisma.$transaction(async (tx) => {
      const plan = await tx.dietPlan.create({
        data: { userId, name: dto.name },
      });
      const slots = await this.insertMealSlots(
        tx,
        plan.id,
        dto.mealSlots ?? [],
      );
      const slotId = new Map(slots.map((s) => [s.order, s.id]));
      const types = await this.insertDayTypes(
        tx,
        plan.id,
        dto.dayTypes.map((d) => ({
          name: d.name,
          order: d.order,
          trainingDay: d.order === dto.trainingDayTypeOrder,
          restDay: d.order === dto.restDayTypeOrder,
          ...values(d),
        })),
      );
      const typeId = new Map(types.map((t) => [t.order, t.id]));
      await this.insertMealTargets(
        tx,
        dto.dayTypes.flatMap((d) =>
          (d.mealTargets ?? []).map((t) => ({
            dayTypeId: typeId.get(d.order)!,
            mealSlotId: slotId.get(t.mealSlotOrder)!,
            ...values(t),
          })),
        ),
      );
      return this.load(tx, userId, plan.id);
    });
  }

  // Edição: a linha do plano é travada antes de ler e gravar (PATCH e DELETE em fila, sem P2025).
  // O estado final é montado em memória, validado como no POST e só então gravado.
  update(userId: string, id: string, dto: UpdateDietPlanDto) {
    return this.prisma.$transaction(async (tx) => {
      const locked = await tx.$queryRaw<
        unknown[]
      >`SELECT 1 FROM diet_plans WHERE id = ${id} AND user_id = ${userId} FOR UPDATE`;
      if (locked.length === 0) throw new NotFoundException(NOT_FOUND);
      const cur = await tx.dietPlan.findFirstOrThrow({
        where: { id, userId },
        include: full,
      });

      const checkIds = (sent: { id?: string }[], own: { id: string }[]) => {
        const ids = sent.flatMap((i) => (i.id ? [i.id] : []));
        if (new Set(ids).size !== ids.length) {
          throw new BadRequestException('id repetido');
        }
        const mine = new Set(own.map((o) => o.id));
        if (ids.some((i) => !mine.has(i))) {
          throw new BadRequestException('id não pertence a este plano');
        }
      };
      checkIds(dto.mealSlots ?? [], cur.mealSlots);
      checkIds(dto.dayTypes ?? [], cur.dayTypes);

      const slots: { id?: string; name: string; order: number }[] =
        dto.mealSlots ??
        cur.mealSlots.map(({ id, name, order }) => ({ id, name, order }));
      // Sem dayTypes no corpo, os tipos atuais seguem; metas de refeição apagadas saem.
      const slotOrderById = new Map(
        slots.flatMap((s) => (s.id ? [[s.id, s.order] as const] : [])),
      );
      const nums = (
        o: Record<(typeof VALUE_FIELDS)[number], Prisma.Decimal | null>,
      ) =>
        values(
          Object.fromEntries(VALUE_FIELDS.map((f) => [f, o[f]?.toNumber()])),
        );
      const types: (DayTypeDto & { id?: string })[] =
        dto.dayTypes ??
        cur.dayTypes.map((d) => ({
          id: d.id,
          name: d.name,
          order: d.order,
          ...nums(d),
          mealTargets: d.mealTargets
            .filter((t) => slotOrderById.has(t.mealSlotId))
            .map((t) => ({
              mealSlotOrder: slotOrderById.get(t.mealSlotId)!,
              ...nums(t),
            })),
        }));

      const orderOfMarked = (flag: 'trainingDay' | 'restDay') => {
        const markedId = cur.dayTypes.find((d) => d[flag])?.id;
        const kept = types.find((d) => d.id === markedId);
        if (!kept) {
          throw new BadRequestException(
            'O tipo de dia marcado foi removido; envie a order do novo',
          );
        }
        return kept.order;
      };
      const final = {
        name: dto.name ?? cur.name,
        mealSlots: slots,
        dayTypes: types,
        trainingDayTypeOrder:
          dto.trainingDayTypeOrder ?? orderOfMarked('trainingDay'),
        restDayTypeOrder: dto.restDayTypeOrder ?? orderOfMarked('restDay'),
      } as CreateDietPlanDto;
      this.validate(final);

      await tx.dietPlan.update({ where: { id }, data: { name: final.name } });
      const keptSlots = slots.flatMap((s) => (s.id ? [s.id] : []));
      await tx.mealSlot.deleteMany({
        where: { dietPlanId: id, id: { notIn: keptSlots } },
      });
      // Só o que mudou, em lote: um plano pode ter milhares de refeições (D4) e a transação tem timeout.
      const slotId = new Map<number, string>();
      const curSlot = new Map(cur.mealSlots.map((m) => [m.id, m]));
      const changed = slots.filter((s) => {
        const c = s.id ? curSlot.get(s.id) : undefined;
        return c && (c.name !== s.name || c.order !== s.order);
      });
      if (changed.length > 0) {
        await tx.$executeRaw`UPDATE meal_slots AS m
          SET name = v.name, "order" = v."order", updated_at = now()
          FROM unnest(${changed.map((s) => s.id!)}::text[], ${changed.map((s) => s.name)}::text[], ${changed.map((s) => s.order)}::int[])
            AS v(id, name, "order")
          WHERE m.id = v.id AND m.diet_plan_id = ${id}`;
      }
      for (const s of slots) if (s.id) slotId.set(s.order, s.id);
      const created = await this.insertMealSlots(
        tx,
        id,
        slots.filter((s) => !s.id),
      );
      for (const m of created) slotId.set(m.order, m.id);
      const keptTypes = types.flatMap((d) => (d.id ? [d.id] : []));
      await tx.dayType.deleteMany({
        where: { dietPlanId: id, id: { notIn: keptTypes } },
      });
      await tx.mealTarget.deleteMany({
        where: { dayTypeId: { in: keptTypes } },
      });
      const curType = new Map(cur.dayTypes.map((d) => [d.id, d]));
      const rows = types.map((d) => ({
        d,
        data: {
          name: d.name,
          order: d.order,
          trainingDay: d.order === final.trainingDayTypeOrder,
          restDay: d.order === final.restDayTypeOrder,
          ...values(d),
        },
      }));
      const changedTypes = rows.filter(({ d, data }) => {
        const c = d.id ? curType.get(d.id) : undefined;
        return (
          c &&
          !(
            c.name === data.name &&
            c.order === data.order &&
            c.trainingDay === data.trainingDay &&
            c.restDay === data.restDay &&
            VALUE_FIELDS.every((f) => (c[f]?.toNumber() ?? null) === data[f])
          )
        );
      });
      if (changedTypes.length > 0) {
        const col = <K extends keyof (typeof rows)[0]['data']>(k: K) =>
          changedTypes.map((r) => r.data[k]);
        await tx.$executeRaw`UPDATE day_types AS t
          SET name = v.name, "order" = v."order", training_day = v.training_day, rest_day = v.rest_day,
            kcal = v.kcal, protein_g = v.protein_g, carbs_g = v.carbs_g, fat_g = v.fat_g, fiber_g = v.fiber_g,
            updated_at = now()
          FROM unnest(${changedTypes.map((r) => r.d.id!)}::text[], ${col('name')}::text[], ${col('order')}::int[],
            ${col('trainingDay')}::boolean[], ${col('restDay')}::boolean[], ${col('kcal')}::numeric[],
            ${col('proteinG')}::numeric[], ${col('carbsG')}::numeric[], ${col('fatG')}::numeric[], ${col('fiberG')}::numeric[])
            AS v(id, name, "order", training_day, rest_day, kcal, protein_g, carbs_g, fat_g, fiber_g)
          WHERE t.id = v.id AND t.diet_plan_id = ${id}`;
      }
      const typeId = new Map<number, string>();
      for (const { d } of rows) if (d.id) typeId.set(d.order, d.id);
      const fresh = rows.filter(({ d }) => !d.id).map((r) => r.data);
      for (const t of await this.insertDayTypes(tx, id, fresh)) {
        typeId.set(t.order, t.id);
      }
      const targets = types.flatMap((d) =>
        (d.mealTargets ?? []).map((t) => ({
          dayTypeId: typeId.get(d.order)!,
          mealSlotId: slotId.get(t.mealSlotOrder)!,
          ...values(t),
        })),
      );
      await this.insertMealTargets(tx, targets);
      return this.load(tx, userId, id);
    });
  }

  async findAll(userId: string) {
    const plans = await this.prisma.dietPlan.findMany({
      where: { userId },
      include: full,
      orderBy: [{ name: 'asc' }, { id: 'asc' }],
    });
    return plans.map((p) => this.out(p));
  }

  findOne(userId: string, id: string) {
    return this.load(this.prisma, userId, id);
  }

  async remove(userId: string, id: string) {
    const { count } = await this.prisma.dietPlan.deleteMany({
      where: { id, userId },
    });
    if (count === 0) throw new NotFoundException(NOT_FOUND);
  }

  // Igual ao programa: a linha do usuário é travada para pôr as ativações dele em fila
  // (sem a trava, o updateMany em duas transações dava deadlock).
  activate(userId: string, id: string) {
    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT 1 FROM users WHERE id = ${userId} FOR NO KEY UPDATE`;
      await tx.dietPlan.updateMany({
        where: { userId },
        data: { active: false },
      });
      const { count } = await tx.dietPlan.updateMany({
        where: { id, userId },
        data: { active: true },
      });
      if (count === 0) throw new NotFoundException(NOT_FOUND);
      return this.load(tx, userId, id);
    });
  }

  async deactivate(userId: string, id: string) {
    const { count } = await this.prisma.dietPlan.updateMany({
      where: { id, userId },
      data: { active: false },
    });
    if (count === 0) throw new NotFoundException(NOT_FOUND);
    return this.load(this.prisma, userId, id);
  }
}
