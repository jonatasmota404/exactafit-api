import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreateDietPlanDto,
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

@Injectable()
export class DietPlansService {
  constructor(private readonly prisma: PrismaService) {}

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
        data: {
          userId,
          name: dto.name,
          mealSlots: {
            create: (dto.mealSlots ?? []).map((s) => ({
              name: s.name,
              order: s.order,
            })),
          },
        },
        include: { mealSlots: true },
      });
      const slotId = new Map(plan.mealSlots.map((s) => [s.order, s.id]));
      for (const d of dto.dayTypes) {
        await tx.dayType.create({
          data: {
            dietPlanId: plan.id,
            name: d.name,
            order: d.order,
            trainingDay: d.order === dto.trainingDayTypeOrder,
            restDay: d.order === dto.restDayTypeOrder,
            ...values(d),
            mealTargets: {
              create: (d.mealTargets ?? []).map((t) => ({
                mealSlotId: slotId.get(t.mealSlotOrder)!,
                ...values(t),
              })),
            },
          },
        });
      }
      return this.load(tx, userId, plan.id);
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
