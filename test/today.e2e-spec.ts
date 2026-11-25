// Tarefa 15: GET /today — refeições do plano ativo, treino do dia pelo ciclo e caminhada.
// Critérios C1–C10 aprovados na conversa (risco médio; vão para a descrição do PR).
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { randomUUID } from 'crypto';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import type { Server } from 'http';

type User = { id: string; token: string };
type Plan = {
  id: string;
  mealSlots: { id: string; name: string; order: number }[];
  dayTypes: { id: string; name: string }[];
};
type Values = {
  kcal: string | null;
  proteinG: string | null;
  carbsG: string | null;
  fatG: string | null;
  fiberG: string | null;
};
type Log = { id: string; mealSlotId: string | null };
type Today = {
  date: string;
  program: { id: string; name: string } | null;
  workouts: { id: string; name: string; order: number }[];
  walk: boolean;
  diet: null | {
    dietPlanId: string;
    name: string;
    dayType: { id: string; name: string } & Values;
    autoDayTypeId: string;
    meals: {
      mealSlotId: string;
      name: string;
      order: number;
      target: Values | null;
      logs: Log[];
    }[];
  };
  otherLogs: Log[];
  consumed: Values;
};

const NOT_IN_PLAN = 'Tipo de dia não pertence ao plano ativo';
const MONDAY = '2026-11-23';
const TUESDAY = '2026-11-24';
const WEDNESDAY = '2026-11-25';

describe('Hoje (tarefa 15)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const userIds: string[] = [];

  const http = () => app.getHttpServer() as Server;
  const auth = (u: User) => ({ Authorization: `Bearer ${u.token}` });
  const message = (res: request.Response) =>
    (res.body as { message: unknown }).message;

  const signUp = async (): Promise<User> => {
    const email = `today15-${randomUUID()}@example.com`;
    const reg = await request(http())
      .post('/auth/register')
      .send({ name: 'Hoje', email, password: 'password123' })
      .expect(201);
    const id = (reg.body as { id: string }).id;
    userIds.push(id);
    const login = await request(http())
      .post('/auth/login')
      .send({ email, password: 'password123' })
      .expect(201);
    return { id, token: (login.body as { accessToken: string }).accessToken };
  };

  const createWorkout = async (u: User, name: string) => {
    const ex = await request(http())
      .post('/exercises')
      .set(auth(u))
      .send({
        name: `Supino ${randomUUID().slice(0, 8)}`,
        muscleGroup: 'chest',
      })
      .expect(201);
    const res = await request(http())
      .post('/workouts')
      .set(auth(u))
      .send({
        name,
        items: [
          {
            exerciseId: (ex.body as { id: string }).id,
            order: 1,
            targetSets: 3,
            targetRepsMin: 10,
            targetRepsMax: 10,
          },
        ],
      })
      .expect(201);
    return (res.body as { id: string }).id;
  };

  const createProgram = async (
    u: User,
    body: Record<string, unknown>,
    activate = true,
  ) => {
    const res = await request(http())
      .post('/programs')
      .set(auth(u))
      .send({ name: 'Programa', ...body });
    expect(res.status).toBe(201);
    const id = (res.body as { id: string }).id;
    if (activate) {
      await request(http())
        .post(`/programs/${id}/activate`)
        .set(auth(u))
        .expect(200);
    }
    return id;
  };

  // Plano com três tipos (Treino, Descanso, Refeed) e refeições enviadas fora de ordem.
  const createPlan = async (u: User, activate = true): Promise<Plan> => {
    const res = await request(http())
      .post('/diet-plans')
      .set(auth(u))
      .send({
        name: `Plano ${randomUUID().slice(0, 8)}`,
        mealSlots: [
          { name: 'Jantar', order: 2 },
          { name: 'Almoço', order: 1 },
        ],
        dayTypes: [
          {
            name: 'Treino',
            order: 1,
            kcal: 2600,
            proteinG: 180,
            mealTargets: [{ mealSlotOrder: 1, kcal: 800 }],
          },
          { name: 'Descanso', order: 2, kcal: 2200 },
          {
            name: 'Refeed',
            order: 3,
            kcal: 3000,
            mealTargets: [{ mealSlotOrder: 2, carbsG: 150 }],
          },
        ],
        trainingDayTypeOrder: 1,
        restDayTypeOrder: 2,
      });
    expect(res.status).toBe(201);
    const plan = res.body as Plan;
    if (activate) {
      await request(http())
        .post(`/diet-plans/${plan.id}/activate`)
        .set(auth(u))
        .expect(200);
    }
    return plan;
  };
  const slot = (p: Plan, name: string) =>
    p.mealSlots.find((m) => m.name === name)!.id;
  const dayType = (p: Plan, name: string) =>
    p.dayTypes.find((d) => d.name === name)!.id;

  const createFood = async (u: User, v: Record<string, unknown>) => {
    const res = await request(http())
      .post('/foods')
      .set(auth(u))
      .send({
        name: `Alimento ${randomUUID().slice(0, 8)}`,
        state: 'COOKED',
        ...v,
      });
    expect(res.status).toBe(201);
    return (res.body as { id: string }).id;
  };

  const logMeal = async (
    u: User,
    eatenAt: string,
    foodId: string,
    grams: number,
    mealSlotId?: string,
  ) => {
    const res = await request(http())
      .post('/meal-logs')
      .set(auth(u))
      .send({
        id: randomUUID(),
        eatenAt,
        ...(mealSlotId ? { mealSlotId } : {}),
        items: [{ foodId, grams }],
      });
    expect(res.status).toBe(201);
    return (res.body as { id: string }).id;
  };

  const today = (u: User, query: string) =>
    request(http()).get(`/today${query}`).set(auth(u));
  const todayOk = async (u: User, query: string) => {
    const res = await today(u, query);
    expect(res.status).toBe(200);
    return res.body as Today;
  };
  const ids = (logs: Log[]) => logs.map((l) => l.id).sort();
  const localToday = (timeZone: string) =>
    new Intl.DateTimeFormat('en-CA', { timeZone }).format(new Date());

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.init();
    prisma = app.get(PrismaService);
  });

  afterAll(async () => {
    if (userIds.length) {
      // Histórico sem cascade (ADR 0001): itens → registros → planos → alimentos;
      // programas → treinos → exercícios.
      await prisma.$executeRawUnsafe(
        `DELETE FROM meal_log_items WHERE meal_log_id IN
           (SELECT id FROM meal_logs WHERE user_id = ANY($1::text[]))`,
        userIds,
      );
      for (const table of [
        'meal_logs',
        'diet_plans',
        'foods',
        'programs',
        'workouts',
        'exercises',
      ]) {
        await prisma.$executeRawUnsafe(
          `DELETE FROM ${table} WHERE user_id = ANY($1::text[])`,
          userIds,
        );
      }
    }
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    await prisma.$disconnect();
    await app.close();
  });

  it('C1: sem token dá 401', async () => {
    await request(http()).get('/today').expect(401);
    await request(http()).get(`/today?date=${MONDAY}`).expect(401);
  });

  it('C1: programa, plano e registros de outro usuário nunca aparecem', async () => {
    const owner = await signUp();
    const a = await createWorkout(owner, 'Treino A');
    await createProgram(owner, {
      cycleType: 'WEEKLY',
      startDate: '2026-11-16',
      days: [{ week: 1, day: 1, workoutId: a, order: 1 }],
    });
    const plan = await createPlan(owner);
    const food = await createFood(owner, {
      kcal: 159,
      proteinG: 32,
      carbsG: 0,
      fatG: 2.5,
    });
    await logMeal(
      owner,
      '2026-11-23T12:30:00-03:00',
      food,
      200,
      slot(plan, 'Almoço'),
    );
    await logMeal(owner, '2026-11-23T16:00:00-03:00', food, 100);

    const other = await signUp();
    const t = await todayOk(other, `?date=${MONDAY}`);
    expect(t.program).toBeNull();
    expect(t.workouts).toEqual([]);
    expect(t.walk).toBe(true);
    expect(t.diet).toBeNull();
    expect(t.otherLogs).toEqual([]);
    expect(t.consumed).toEqual({
      kcal: '0',
      proteinG: '0',
      carbsG: '0',
      fatG: '0',
      fiberG: null,
    });

    // O tipo de dia do plano de outro usuário também não serve.
    const res = await today(
      other,
      `?date=${MONDAY}&dayTypeId=${dayType(plan, 'Refeed')}`,
    );
    expect(res.status).toBe(400);
    expect(message(res)).toBe(NOT_IN_PLAN);
  });

  it('C2: sem date vale o dia de hoje no fuso do perfil', async () => {
    const u = await signUp();
    expect((await todayOk(u, '')).date).toBe(localToday('America/Sao_Paulo'));

    await request(http())
      .patch('/me/profile')
      .set(auth(u))
      .send({ timezone: 'Pacific/Kiritimati' })
      .expect(200);
    expect((await todayOk(u, '')).date).toBe(localToday('Pacific/Kiritimati'));
  });

  it('C2: com date, a resposta é daquele dia', async () => {
    const u = await signUp();
    expect((await todayOk(u, `?date=${TUESDAY}`)).date).toBe(TUESDAY);
  });

  it('C2: date impossível, em outro formato ou repetida, e parâmetro desconhecido dão 400', async () => {
    const u = await signUp();
    for (const q of [
      '?date=2026-02-30',
      '?date=23-11-2026',
      '?date=2026-11-23T00:00:00Z',
      '?date=0050-01-01',
      `?date=${MONDAY}&date=${TUESDAY}`,
      '?foo=1',
      `?date=${MONDAY}&userId=${u.id}`,
    ]) {
      const res = await today(u, q);
      expect({ q, status: res.status }).toEqual({ q, status: 400 });
    }
  });

  it('C6: dia anterior ao startDate do programa ativo não tem treino', async () => {
    const u = await signUp();
    const a = await createWorkout(u, 'Treino A');
    const programId = await createProgram(u, {
      cycleType: 'WEEKLY',
      startDate: '2026-11-16',
      days: [{ week: 1, day: 1, workoutId: a, order: 1 }],
    });
    const t = await todayOk(u, '?date=2026-11-09'); // segunda anterior ao início
    expect(t.program).toEqual({ id: programId, name: 'Programa' });
    expect(t.workouts).toEqual([]);
    expect(t.walk).toBe(true);
  });

  it('C7: sem programa ativo dá program null, sem treino e com caminhada', async () => {
    const u = await signUp();
    const a = await createWorkout(u, 'Treino A');
    await createProgram(
      u,
      {
        cycleType: 'WEEKLY',
        startDate: '2026-11-16',
        days: [{ week: 1, day: 1, workoutId: a, order: 1 }],
      },
      false,
    );
    const t = await todayOk(u, `?date=${MONDAY}`);
    expect(t.program).toBeNull();
    expect(t.workouts).toEqual([]);
    expect(t.walk).toBe(true);
  });

  it('C7: dia com várias linhas traz os treinos por order; dia sem linha traz a caminhada', async () => {
    const u = await signUp();
    const a = await createWorkout(u, 'Treino A');
    const b = await createWorkout(u, 'Treino B');
    const programId = await createProgram(u, {
      name: 'Semanal',
      cycleType: 'WEEKLY',
      startDate: '2026-11-16',
      days: [
        { week: 1, day: 1, workoutId: a, order: 2 },
        { week: 1, day: 1, workoutId: b, order: 1 },
        { week: 1, day: 3, workoutId: a, order: 0 },
      ],
    });

    const monday = await todayOk(u, `?date=${MONDAY}`);
    expect(monday.program).toEqual({ id: programId, name: 'Semanal' });
    expect(monday.workouts).toEqual([
      { id: b, name: 'Treino B', order: 1 },
      { id: a, name: 'Treino A', order: 2 },
    ]);
    expect(monday.walk).toBe(false);

    const tuesday = await todayOk(u, `?date=${TUESDAY}`);
    expect(tuesday.program).toEqual({ id: programId, name: 'Semanal' });
    expect(tuesday.workouts).toEqual([]);
    expect(tuesday.walk).toBe(true);

    const wednesday = await todayOk(u, `?date=${WEDNESDAY}`);
    expect(wednesday.workouts).toEqual([{ id: a, name: 'Treino A', order: 0 }]);
  });

  it('C7: rotativo e semanal A-B pela API usam o dia do ciclo', async () => {
    const u = await signUp();
    const a = await createWorkout(u, 'Treino A');
    const b = await createWorkout(u, 'Treino B');
    await createProgram(u, {
      cycleType: 'ROTATING',
      cycleDays: 3,
      startDate: '2026-11-23',
      days: [
        { week: 1, day: 1, workoutId: a, order: 1 },
        { week: 1, day: 2, workoutId: b, order: 1 },
      ],
    });
    expect((await todayOk(u, '?date=2026-11-24')).workouts).toEqual([
      { id: b, name: 'Treino B', order: 1 },
    ]);
    expect((await todayOk(u, '?date=2026-11-25')).walk).toBe(true); // dia 3
    expect((await todayOk(u, '?date=2026-11-26')).workouts).toEqual([
      { id: a, name: 'Treino A', order: 1 },
    ]);

    // Ativar outro programa: o semanal A-B passa a valer.
    await createProgram(u, {
      cycleType: 'WEEKLY',
      weeks: 2,
      startDate: '2026-11-25', // quarta: semana 1 é 23–29/11
      days: [
        { week: 1, day: 1, workoutId: a, order: 1 },
        { week: 2, day: 1, workoutId: b, order: 1 },
      ],
    });
    expect((await todayOk(u, '?date=2026-11-30')).workouts).toEqual([
      { id: b, name: 'Treino B', order: 1 },
    ]);
    expect((await todayOk(u, '?date=2026-12-07')).workouts).toEqual([
      { id: a, name: 'Treino A', order: 1 },
    ]);
  });

  it('C8: dia com treino usa o tipo de treino; dia sem treino, o de descanso; refeições por order com meta e registros', async () => {
    const u = await signUp();
    const a = await createWorkout(u, 'Treino A');
    await createProgram(u, {
      cycleType: 'WEEKLY',
      startDate: '2026-11-16',
      days: [{ week: 1, day: 1, workoutId: a, order: 1 }],
    });
    const plan = await createPlan(u);
    const food = await createFood(u, {
      kcal: 159,
      proteinG: 32,
      carbsG: 0,
      fatG: 2.5,
    });
    const lunch = await logMeal(
      u,
      '2026-11-23T12:30:00-03:00',
      food,
      200,
      slot(plan, 'Almoço'),
    );

    const monday = await todayOk(u, `?date=${MONDAY}`);
    expect(monday.diet).not.toBeNull();
    const diet = monday.diet!;
    expect(diet.dietPlanId).toBe(plan.id);
    expect(diet.dayType).toEqual({
      id: dayType(plan, 'Treino'),
      name: 'Treino',
      kcal: '2600',
      proteinG: '180',
      carbsG: null,
      fatG: null,
      fiberG: null,
    });
    expect(diet.autoDayTypeId).toBe(dayType(plan, 'Treino'));
    expect(diet.meals.map((m) => [m.name, m.order])).toEqual([
      ['Almoço', 1],
      ['Jantar', 2],
    ]);
    expect(diet.meals[0].mealSlotId).toBe(slot(plan, 'Almoço'));
    expect(diet.meals[0].target).toEqual({
      kcal: '800',
      proteinG: null,
      carbsG: null,
      fatG: null,
      fiberG: null,
    });
    expect(diet.meals[1].target).toBeNull();
    expect(ids(diet.meals[0].logs)).toEqual([lunch]);
    expect(diet.meals[1].logs).toEqual([]);

    // Os registros vêm no mesmo formato de GET /meal-logs.
    const list = await request(http())
      .get(`/meal-logs?date=${MONDAY}`)
      .set(auth(u))
      .expect(200);
    expect(diet.meals[0].logs).toEqual(list.body);

    const tuesday = await todayOk(u, `?date=${TUESDAY}`);
    expect(tuesday.diet!.dayType.id).toBe(dayType(plan, 'Descanso'));
    expect(tuesday.diet!.autoDayTypeId).toBe(dayType(plan, 'Descanso'));
    expect(tuesday.diet!.meals.every((m) => m.target === null)).toBe(true);
    expect(tuesday.diet!.meals.every((m) => m.logs.length === 0)).toBe(true);
  });

  it('C9: registros fora do plano ativo vão em otherLogs; consumed soma o dia sem os apagados', async () => {
    const u = await signUp();
    const plan = await createPlan(u);
    const oldPlan = await createPlan(u, false);
    const frango = await createFood(u, {
      kcal: 159,
      proteinG: 32,
      carbsG: 0,
      fatG: 2.5,
    });
    const arroz = await createFood(u, {
      kcal: 130,
      proteinG: 2.5,
      carbsG: 28,
      fatG: 0.3,
      fiberG: 1.6,
    });
    const lunch = await logMeal(
      u,
      '2026-11-23T12:30:00-03:00',
      frango,
      200,
      slot(plan, 'Almoço'),
    );
    const snack = await logMeal(u, '2026-11-23T16:00:00-03:00', arroz, 100);
    const fromOldPlan = await logMeal(
      u,
      '2026-11-23T20:00:00-03:00',
      frango,
      100,
      slot(oldPlan, 'Jantar'),
    );
    const deleted = await logMeal(
      u,
      '2026-11-23T21:00:00-03:00',
      frango,
      300,
      slot(plan, 'Jantar'),
    );
    await request(http())
      .delete(`/meal-logs/${deleted}`)
      .set(auth(u))
      .expect(204);
    await logMeal(u, '2026-11-24T12:00:00-03:00', frango, 500); // outro dia

    const t = await todayOk(u, `?date=${MONDAY}`);
    expect(ids(t.otherLogs)).toEqual([snack, fromOldPlan].sort());
    expect(ids(t.diet!.meals[0].logs)).toEqual([lunch]);
    expect(t.diet!.meals[1].logs).toEqual([]);
    // 318 + 130 + 159 kcal; fibra só do arroz.
    expect(t.consumed).toEqual({
      kcal: '607',
      proteinG: '98.5',
      carbsG: '28',
      fatG: '7.8',
      fiberG: '1.6',
    });

    // Sem plano ativo: diet null e todos os registros do dia em otherLogs.
    await request(http())
      .post(`/diet-plans/${plan.id}/deactivate`)
      .set(auth(u))
      .expect(200);
    const noPlan = await todayOk(u, `?date=${MONDAY}`);
    expect(noPlan.diet).toBeNull();
    expect(ids(noPlan.otherLogs)).toEqual([lunch, snack, fromOldPlan].sort());
    expect(noPlan.consumed.kcal).toBe('607');
  });

  it('C9: dia sem registro com fibra dá fiberG null em consumed', async () => {
    const u = await signUp();
    const frango = await createFood(u, {
      kcal: 159,
      proteinG: 32,
      carbsG: 0,
      fatG: 2.5,
    });
    await logMeal(u, '2026-11-23T12:30:00-03:00', frango, 100);
    expect((await todayOk(u, `?date=${MONDAY}`)).consumed).toEqual({
      kcal: '159',
      proteinG: '32',
      carbsG: '0',
      fatG: '2.5',
      fiberG: null,
    });
  });

  it('C10: dayTypeId do plano ativo troca o tipo e as metas; autoDayTypeId continua o automático', async () => {
    const u = await signUp();
    const plan = await createPlan(u);
    const t = await todayOk(
      u,
      `?date=${TUESDAY}&dayTypeId=${dayType(plan, 'Refeed')}`,
    );
    expect(t.diet!.dayType).toMatchObject({
      id: dayType(plan, 'Refeed'),
      name: 'Refeed',
      kcal: '3000',
    });
    expect(t.diet!.autoDayTypeId).toBe(dayType(plan, 'Descanso'));
    expect(t.diet!.meals[0].target).toBeNull();
    expect(t.diet!.meals[1].target).toEqual({
      kcal: null,
      proteinG: null,
      carbsG: '150',
      fatG: null,
      fiberG: null,
    });
  });

  it('C10: dayTypeId de outro plano, inexistente ou sem plano ativo dá 400; não uuid dá 400', async () => {
    const u = await signUp();
    const plan = await createPlan(u);
    const other = await createPlan(u, false);
    for (const id of [dayType(other, 'Refeed'), randomUUID()]) {
      const res = await today(u, `?date=${MONDAY}&dayTypeId=${id}`);
      expect(res.status).toBe(400);
      expect(message(res)).toBe(NOT_IN_PLAN);
    }
    expect((await today(u, `?date=${MONDAY}&dayTypeId=abc`)).status).toBe(400);

    await request(http())
      .post(`/diet-plans/${plan.id}/deactivate`)
      .set(auth(u))
      .expect(200);
    const res = await today(
      u,
      `?date=${MONDAY}&dayTypeId=${dayType(plan, 'Treino')}`,
    );
    expect(res.status).toBe(400);
    expect(message(res)).toBe(NOT_IN_PLAN);
  });
});
