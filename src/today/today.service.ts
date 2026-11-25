import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { MealLogsService } from '../meal-logs/meal-logs.service';
import { PrismaService } from '../prisma/prisma.service';
import { cycleDay } from './cycle';

const NOT_IN_PLAN = 'Tipo de dia não pertence ao plano ativo';

type Key = 'kcal' | 'proteinG' | 'carbsG' | 'fatG' | 'fiberG';
type Values = Record<Key, string | null>;
type Dec = Prisma.Decimal | null;

const values = (v: Record<Key, Dec>): Values => ({
  kcal: v.kcal?.toString() ?? null,
  proteinG: v.proteinG?.toString() ?? null,
  carbsG: v.carbsG?.toString() ?? null,
  fatG: v.fatG?.toString() ?? null,
  fiberG: v.fiberG?.toString() ?? null,
});

@Injectable()
export class TodayService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mealLogs: MealLogsService,
  ) {}

  async get(userId: string, dateParam?: string, dayTypeId?: string) {
    const { timezone } = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { timezone: true },
    });
    const date =
      dateParam ??
      new Intl.DateTimeFormat('en-CA', { timeZone: timezone }).format(
        new Date(),
      );

    const [program, plan, logs] = await Promise.all([
      this.prisma.program.findFirst({ where: { userId, active: true } }),
      this.prisma.dietPlan.findFirst({
        where: { userId, active: true },
        include: {
          mealSlots: {
            orderBy: [{ order: 'asc' }, { id: 'asc' }],
            include: { targets: true },
          },
          dayTypes: true,
        },
      }),
      this.mealLogs.list(userId, date),
    ]);

    let workouts: { id: string; name: string; order: number }[] = [];
    if (program) {
      const cd = cycleDay(
        {
          cycleType: program.cycleType,
          cycleDays: program.cycleDays,
          weeks: program.weeks,
          startDate: program.startDate.toISOString().slice(0, 10),
        },
        date,
      );
      if (cd) {
        const rows = await this.prisma.programDay.findMany({
          where: { programId: program.id, week: cd.week, day: cd.day },
          orderBy: [{ order: 'asc' }, { id: 'asc' }],
          include: { workout: { select: { id: true, name: true } } },
        });
        workouts = rows.map((r) => ({
          id: r.workout.id,
          name: r.workout.name,
          order: r.order,
        }));
      }
    }

    let diet: object | null = null;
    let planSlotIds = new Set<string>();
    if (plan) {
      const trains = workouts.length > 0;
      const auto = plan.dayTypes.find((d) =>
        trains ? d.trainingDay : d.restDay,
      );
      const chosen = dayTypeId
        ? plan.dayTypes.find((d) => d.id === dayTypeId)
        : auto;
      if (!chosen || !auto) throw new BadRequestException(NOT_IN_PLAN);
      planSlotIds = new Set(plan.mealSlots.map((s) => s.id));
      diet = {
        dietPlanId: plan.id,
        name: plan.name,
        dayType: { id: chosen.id, name: chosen.name, ...values(chosen) },
        autoDayTypeId: auto.id,
        meals: plan.mealSlots.map((s) => {
          const t = s.targets.find((x) => x.dayTypeId === chosen.id);
          return {
            mealSlotId: s.id,
            name: s.name,
            order: s.order,
            target: t ? values(t) : null,
            logs: logs.filter((l) => l.mealSlotId === s.id),
          };
        }),
      };
    } else if (dayTypeId) {
      throw new BadRequestException(NOT_IN_PLAN);
    }

    const total = (k: Key) => {
      const v = logs.map((l) => l.totals[k]).filter((x) => x !== null);
      return v.length === 0 ? null : Prisma.Decimal.sum(...v).toString();
    };
    return {
      date,
      program: program ? { id: program.id, name: program.name } : null,
      workouts,
      walk: workouts.length === 0,
      diet,
      otherLogs: logs.filter(
        (l) => !l.mealSlotId || !planSlotIds.has(l.mealSlotId),
      ),
      consumed: {
        kcal: total('kcal') ?? '0',
        proteinG: total('proteinG') ?? '0',
        carbsG: total('carbsG') ?? '0',
        fatG: total('fatG') ?? '0',
        fiberG: total('fiberG'),
      },
    };
  }
}
