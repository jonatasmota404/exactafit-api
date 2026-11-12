// Tarefa 11a: plano de dieta (/diet-plans). Plano: docs/plans/2026-11-12-plano-de-dieta.md.
// 11a-1: C1–C14 (criar, ler, apagar, ativar).
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { randomUUID } from 'crypto';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import type { Server } from 'http';

type User = { id: string; token: string };
type Values = {
  kcal: string | null;
  proteinG: string | null;
  carbsG: string | null;
  fatG: string | null;
  fiberG: string | null;
};
type MealSlot = { id: string; name: string; order: number };
type DayType = Values & {
  id: string;
  name: string;
  order: number;
  mealTargets: (Values & { mealSlotId: string })[];
  mealTargetsSum: Values;
};
type Plan = {
  id: string;
  name: string;
  active: boolean;
  trainingDayTypeId: string;
  restDayTypeId: string;
  mealSlots: MealSlot[];
  dayTypes: DayType[];
  createdAt: string;
  updatedAt: string;
};

const NOT_FOUND = 'Plano de dieta não encontrado';
const NULLS = {
  kcal: null,
  proteinG: null,
  carbsG: null,
  fatG: null,
  fiberG: null,
};

// Modelo B: 4 refeições, um tipo de dia, 340/615/310/615 (metas fora de ordem de propósito).
const planB = (name = `Recomposição ${randomUUID()}`) => ({
  name,
  mealSlots: [
    { name: 'Café', order: 1 },
    { name: 'Almoço', order: 2 },
    { name: 'Lanche', order: 3 },
    { name: 'Jantar', order: 4 },
  ],
  dayTypes: [
    {
      name: 'Todos os dias',
      order: 1,
      kcal: 1900,
      proteinG: 140,
      mealTargets: [
        { mealSlotOrder: 3, kcal: 310 },
        { mealSlotOrder: 1, kcal: 340 },
        { mealSlotOrder: 4, kcal: 615 },
        { mealSlotOrder: 2, kcal: 615 },
      ],
    },
  ],
  trainingDayTypeOrder: 1,
  restDayTypeOrder: 1,
});

// Plano mínimo: um tipo de dia, sem refeições.
const minimal = (name = `Mínimo ${randomUUID()}`) => ({
  name,
  dayTypes: [{ name: 'Dia', order: 0, kcal: 2000 }],
  trainingDayTypeOrder: 0,
  restDayTypeOrder: 0,
});

describe('Plano de dieta (tarefa 11a-1)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const userIds: string[] = [];

  const http = () => app.getHttpServer() as Server;
  const auth = (u: User) => ({ Authorization: `Bearer ${u.token}` });

  const signUp = async (): Promise<User> => {
    const email = `diet11-${randomUUID()}@example.com`;
    const reg = await request(http())
      .post('/auth/register')
      .send({ name: 'Dieta', email, password: 'password123' })
      .expect(201);
    const id = (reg.body as { id: string }).id;
    userIds.push(id);
    const login = await request(http())
      .post('/auth/login')
      .send({ email, password: 'password123' })
      .expect(201);
    return { id, token: (login.body as { accessToken: string }).accessToken };
  };

  const post = (u: User, body: unknown) =>
    request(http())
      .post('/diet-plans')
      .set(auth(u))
      .send(body as object);
  const create = async (u: User, body: unknown = minimal()) => {
    const res = await post(u, body);
    expect(res.status).toBe(201);
    return res.body as Plan;
  };
  const countPlans = async (userId: string) =>
    (
      await prisma.$queryRawUnsafe<{ n: number }[]>(
        'SELECT count(*)::int AS n FROM diet_plans WHERE user_id = $1',
        userId,
      )
    )[0].n;
  const activeIds = async (userId: string) =>
    (
      await prisma.$queryRawUnsafe<{ id: string }[]>(
        'SELECT id FROM diet_plans WHERE user_id = $1 AND active ORDER BY id',
        userId,
      )
    ).map((r) => r.id);

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
      await prisma.$executeRawUnsafe(
        'DELETE FROM diet_plans WHERE user_id = ANY($1::text[])',
        userIds,
      );
    }
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    await prisma.$disconnect();
    await app.close();
  });

  it('C1: cria o modelo B; corpo, ordem, metas pela ordem da refeição e soma', async () => {
    const u = await signUp();
    const body = planB();
    const res = await post(u, body);
    expect(res.status).toBe(201);
    const plan = res.body as Plan & Record<string, unknown>;
    expect(Object.keys(plan).sort()).toEqual(
      [
        'active',
        'createdAt',
        'dayTypes',
        'id',
        'mealSlots',
        'name',
        'restDayTypeId',
        'trainingDayTypeId',
        'updatedAt',
      ].sort(),
    );
    expect(plan).not.toHaveProperty('userId');
    expect(plan.name).toBe(body.name);
    expect(plan.active).toBe(false);
    expect(plan.mealSlots.map((m) => [m.name, m.order])).toEqual([
      ['Café', 1],
      ['Almoço', 2],
      ['Lanche', 3],
      ['Jantar', 4],
    ]);
    expect(plan.dayTypes).toHaveLength(1);
    const [day] = plan.dayTypes;
    expect(plan.trainingDayTypeId).toBe(day.id);
    expect(plan.restDayTypeId).toBe(day.id);
    expect(day).toMatchObject({
      name: 'Todos os dias',
      order: 1,
      kcal: '1900',
      proteinG: '140',
      carbsG: null,
      fatG: null,
      fiberG: null,
    });
    expect(day.mealTargets).toEqual(
      [
        ['340', 0],
        ['615', 1],
        ['310', 2],
        ['615', 3],
      ].map(([kcal, i]) => ({
        ...NULLS,
        mealSlotId: plan.mealSlots[i as number].id,
        kcal,
      })),
    );
    expect(day.mealTargetsSum).toEqual({ ...NULLS, kcal: '1880' });
  });

  it('C2: dois tipos de dia sem refeições; treino e descanso apontam para os tipos certos', async () => {
    const u = await signUp();
    const plan = await create(u, {
      name: 'Treino e descanso',
      dayTypes: [
        { name: 'Descanso', order: 2, kcal: 2100 },
        { name: 'Treino', order: 1, kcal: 2400, proteinG: 165 },
      ],
      trainingDayTypeOrder: 1,
      restDayTypeOrder: 2,
    });
    expect(plan.mealSlots).toEqual([]);
    expect(plan.dayTypes.map((d) => d.name)).toEqual(['Treino', 'Descanso']);
    const byName = Object.fromEntries(plan.dayTypes.map((d) => [d.name, d]));
    expect(plan.trainingDayTypeId).toBe(byName['Treino'].id);
    expect(plan.restDayTypeId).toBe(byName['Descanso'].id);
    expect(byName['Treino'].kcal).toBe('2400');
    expect(byName['Treino'].mealTargetsSum).toEqual(NULLS);
  });

  describe('C3: valores da meta', () => {
    const dayWith = (target: Record<string, unknown>) => ({
      name: 'Valores',
      dayTypes: [{ name: 'Dia', order: 1, ...target }],
      trainingDayTypeOrder: 1,
      restDayTypeOrder: 1,
    });
    const mealWith = (target: Record<string, unknown>) => ({
      name: 'Valores',
      mealSlots: [{ name: 'Café', order: 1 }],
      dayTypes: [
        {
          name: 'Dia',
          order: 1,
          kcal: 2000,
          mealTargets: [{ mealSlotOrder: 1, ...target }],
        },
      ],
      trainingDayTypeOrder: 1,
      restDayTypeOrder: 1,
    });
    const invalid: [string, Record<string, unknown>][] = [
      ['nenhum valor', {}],
      ['só nulos', { kcal: null, proteinG: null }],
      ['negativo', { kcal: -1 }],
      ['2 casas', { proteinG: 12.55 }],
      ['acima de 99999.9', { kcal: 100000 }],
      ['texto', { carbsG: 'abc' }],
    ];
    for (const [name, target] of invalid) {
      for (const [where, build] of [
        ['dia', dayWith],
        ['refeição', mealWith],
      ] as const) {
        it(`400 e nada gravado: ${name} (${where})`, async () => {
          const u = await signUp();
          const res = await post(u, build(target));
          expect(res.status).toBe(400);
          expect(await countPlans(u.id)).toBe(0);
        });
      }
    }
    it('201 nas bordas: 0 e 99999.9', async () => {
      const u = await signUp();
      const plan = await create(
        u,
        mealWith({ kcal: 0, proteinG: 99999.9, fiberG: 0 }),
      );
      expect(plan.dayTypes[0].mealTargets[0]).toMatchObject({
        kcal: '0',
        proteinG: '99999.9',
        fiberG: '0',
      });
    });
  });

  it('C4: a soma conta só as metas que têm o campo; campo que nenhuma tem fica null', async () => {
    const u = await signUp();
    const plan = await create(u, {
      name: 'Soma',
      mealSlots: [
        { name: 'A', order: 1 },
        { name: 'B', order: 2 },
        { name: 'C', order: 3 },
      ],
      dayTypes: [
        {
          name: 'Dia',
          order: 1,
          kcal: 2000,
          mealTargets: [
            { mealSlotOrder: 1, kcal: 500.5, proteinG: 40 },
            { mealSlotOrder: 2, kcal: 300 },
          ],
        },
      ],
      trainingDayTypeOrder: 1,
      restDayTypeOrder: 1,
    });
    expect(plan.dayTypes[0].mealTargetsSum).toEqual({
      ...NULLS,
      kcal: '800.5',
      proteinG: '40',
    });
  });

  describe('C5: estrutura inválida → 400 e nada gravado', () => {
    const base = () => planB('Estrutura');
    const cases: [string, () => Record<string, unknown>][] = [
      ['dayTypes vazio', () => ({ ...base(), dayTypes: [] })],
      [
        'dayTypes ausente',
        () => {
          const b: Record<string, unknown> = base();
          delete b.dayTypes;
          return b;
        },
      ],
      [
        'order repetido entre refeições',
        () => ({
          ...base(),
          mealSlots: [
            { name: 'X', order: 1 },
            { name: 'Y', order: 1 },
          ],
          dayTypes: [{ name: 'Dia', order: 1, kcal: 1 }],
        }),
      ],
      [
        'order repetido entre tipos',
        () => ({
          ...base(),
          dayTypes: [
            { name: 'A', order: 1, kcal: 1 },
            { name: 'B', order: 1, kcal: 2 },
          ],
        }),
      ],
      [
        'trainingDayTypeOrder ausente',
        () => {
          const b: Record<string, unknown> = base();
          delete b.trainingDayTypeOrder;
          return b;
        },
      ],
      [
        'restDayTypeOrder ausente',
        () => {
          const b: Record<string, unknown> = base();
          delete b.restDayTypeOrder;
          return b;
        },
      ],
      [
        'trainingDayTypeOrder que não existe',
        () => ({ ...base(), trainingDayTypeOrder: 9 }),
      ],
      [
        'restDayTypeOrder que não existe',
        () => ({ ...base(), restDayTypeOrder: 9 }),
      ],
      [
        'mealSlotOrder que não existe',
        () => ({
          ...base(),
          dayTypes: [
            {
              name: 'Dia',
              order: 1,
              kcal: 1,
              mealTargets: [{ mealSlotOrder: 9, kcal: 1 }],
            },
          ],
        }),
      ],
      [
        'duas metas para a mesma refeição no mesmo tipo',
        () => ({
          ...base(),
          dayTypes: [
            {
              name: 'Dia',
              order: 1,
              kcal: 1,
              mealTargets: [
                { mealSlotOrder: 1, kcal: 1 },
                { mealSlotOrder: 1, kcal: 2 },
              ],
            },
          ],
        }),
      ],
      ['name do plano vazio', () => ({ ...base(), name: '' })],
      ['name do plano com 101', () => ({ ...base(), name: 'x'.repeat(101) })],
      ['name do plano com byte nulo', () => ({ ...base(), name: 'a\u0000b' })],
      [
        'name da refeição vazio',
        () => ({
          ...base(),
          mealSlots: [{ name: '', order: 1 }],
          dayTypes: [{ name: 'Dia', order: 1, kcal: 1 }],
        }),
      ],
      [
        'name da refeição com byte nulo',
        () => ({
          ...base(),
          mealSlots: [{ name: 'a\u0000', order: 1 }],
          dayTypes: [{ name: 'Dia', order: 1, kcal: 1 }],
        }),
      ],
      [
        'name do tipo com 101',
        () => ({
          ...base(),
          dayTypes: [{ name: 'x'.repeat(101), order: 1, kcal: 1 }],
        }),
      ],
      [
        'name do tipo com byte nulo',
        () => ({
          ...base(),
          dayTypes: [{ name: '\u0000', order: 1, kcal: 1 }],
        }),
      ],
      [
        'order negativo',
        () => ({
          ...base(),
          mealSlots: [{ name: 'X', order: -1 }],
          dayTypes: [{ name: 'Dia', order: 1, kcal: 1 }],
        }),
      ],
      [
        'order fracionário',
        () => ({
          ...base(),
          dayTypes: [{ name: 'Dia', order: 1.5, kcal: 1 }],
          trainingDayTypeOrder: 1.5,
          restDayTypeOrder: 1.5,
        }),
      ],
      [
        'order acima do int4',
        () => ({
          ...base(),
          dayTypes: [{ name: 'Dia', order: 2147483648, kcal: 1 }],
          trainingDayTypeOrder: 2147483648,
          restDayTypeOrder: 2147483648,
        }),
      ],
      [
        'trainingDayTypeOrder negativo',
        () => ({ ...base(), trainingDayTypeOrder: -1 }),
      ],
      [
        'restDayTypeOrder fracionário',
        () => ({ ...base(), restDayTypeOrder: 1.5 }),
      ],
      [
        'mealSlotOrder acima do int4',
        () => ({
          ...base(),
          dayTypes: [
            {
              name: 'Dia',
              order: 1,
              kcal: 1,
              mealTargets: [{ mealSlotOrder: 2147483648, kcal: 1 }],
            },
          ],
        }),
      ],
    ];
    for (const [name, build] of cases) {
      it(name, async () => {
        const u = await signUp();
        const res = await post(u, build());
        expect(res.status).toBe(400);
        expect(await countPlans(u.id)).toBe(0);
      });
    }
  });

  it('C6: active, userId ou campo desconhecido no corpo dão 400', async () => {
    const u = await signUp();
    const other = await signUp();
    for (const extra of [
      { active: true },
      { userId: other.id },
      { cor: 'azul' },
    ]) {
      const res = await post(u, { ...minimal(), ...extra });
      expect(res.status).toBe(400);
    }
    expect(await countPlans(u.id)).toBe(0);
    expect(await countPlans(other.id)).toBe(0);
  });

  it('C7: lista só os próprios, por nome e id, no formato de C1', async () => {
    const u = await signUp();
    const other = await signUp();
    const b = await create(u, minimal('B plano'));
    const a1 = await create(u, minimal('A plano'));
    const a2 = await create(u, minimal('A plano'));
    await create(other, minimal('A plano'));
    const res = await request(http()).get('/diet-plans').set(auth(u));
    expect(res.status).toBe(200);
    const plans = res.body as Plan[];
    const [x, y] = [a1, a2].sort((p, q) => (p.id < q.id ? -1 : 1));
    expect(plans.map((p) => p.id)).toEqual([x.id, y.id, b.id]);
    expect(plans[2]).toEqual(b);
  });

  it('C8: busca o próprio por id', async () => {
    const u = await signUp();
    const plan = await create(u, planB());
    const res = await request(http())
      .get(`/diet-plans/${plan.id}`)
      .set(auth(u));
    expect(res.status).toBe(200);
    expect(res.body).toEqual(plan);
  });

  it('C9: alheio ou inexistente dá 404 em GET, DELETE, activate e deactivate; id inválido 400', async () => {
    const u = await signUp();
    const other = await signUp();
    const theirs = await create(other, minimal());
    for (const id of [theirs.id, randomUUID()]) {
      const calls = [
        () => request(http()).get(`/diet-plans/${id}`).set(auth(u)),
        () => request(http()).delete(`/diet-plans/${id}`).set(auth(u)),
        () => request(http()).post(`/diet-plans/${id}/activate`).set(auth(u)),
        () => request(http()).post(`/diet-plans/${id}/deactivate`).set(auth(u)),
      ];
      for (const call of calls) {
        const res = await call();
        expect(res.status).toBe(404);
        expect((res.body as { message: string }).message).toBe(NOT_FOUND);
      }
    }
    expect(await countPlans(other.id)).toBe(1);
    expect(await activeIds(other.id)).toEqual([]);
    const invalid = [
      () => request(http()).get('/diet-plans/nao-e-uuid').set(auth(u)),
      () => request(http()).delete('/diet-plans/nao-e-uuid').set(auth(u)),
      () =>
        request(http()).post('/diet-plans/nao-e-uuid/activate').set(auth(u)),
      () =>
        request(http()).post('/diet-plans/nao-e-uuid/deactivate').set(auth(u)),
    ];
    for (const call of invalid) {
      expect((await call()).status).toBe(400);
    }
  });

  it('C10: DELETE dá 204 e leva refeições, tipos e metas junto', async () => {
    const u = await signUp();
    const plan = await create(u, planB());
    await request(http())
      .delete(`/diet-plans/${plan.id}`)
      .set(auth(u))
      .expect(204);
    const [counts] = await prisma.$queryRawUnsafe<
      { plans: number; slots: number; types: number; targets: number }[]
    >(
      `SELECT
         (SELECT count(*)::int FROM diet_plans WHERE id = $1) AS plans,
         (SELECT count(*)::int FROM meal_slots WHERE diet_plan_id = $1) AS slots,
         (SELECT count(*)::int FROM day_types WHERE diet_plan_id = $1) AS types,
         (SELECT count(*)::int FROM meal_targets WHERE day_type_id = $2) AS targets`,
      plan.id,
      plan.dayTypes[0].id,
    );
    expect(counts).toEqual({ plans: 0, slots: 0, types: 0, targets: 0 });
  });

  it('C11: activate ativa este e desativa os outros do usuário; os de outro usuário não mudam', async () => {
    const u = await signUp();
    const other = await signUp();
    const p1 = await create(u);
    const p2 = await create(u);
    const theirs = await create(other);
    await request(http())
      .post(`/diet-plans/${theirs.id}/activate`)
      .set(auth(other))
      .expect(200);
    const r1 = await request(http())
      .post(`/diet-plans/${p1.id}/activate`)
      .set(auth(u));
    expect(r1.status).toBe(200);
    expect((r1.body as Plan).active).toBe(true);
    const r2 = await request(http())
      .post(`/diet-plans/${p2.id}/activate`)
      .set(auth(u));
    expect(r2.status).toBe(200);
    expect(await activeIds(u.id)).toEqual([p2.id]);
    expect(await activeIds(other.id)).toEqual([theirs.id]);
  });

  it('C12: deactivate deixa sem ativo; apagar o ativo também', async () => {
    const u = await signUp();
    const p1 = await create(u);
    const p2 = await create(u);
    await request(http())
      .post(`/diet-plans/${p1.id}/activate`)
      .set(auth(u))
      .expect(200);
    const off = await request(http())
      .post(`/diet-plans/${p1.id}/deactivate`)
      .set(auth(u));
    expect(off.status).toBe(200);
    expect((off.body as Plan).active).toBe(false);
    expect(await activeIds(u.id)).toEqual([]);

    await request(http())
      .post(`/diet-plans/${p2.id}/activate`)
      .set(auth(u))
      .expect(200);
    await request(http())
      .delete(`/diet-plans/${p2.id}`)
      .set(auth(u))
      .expect(204);
    expect(await activeIds(u.id)).toEqual([]);
  });

  it('C13: dois activate ao mesmo tempo terminam com exatamente um ativo, sem 500', async () => {
    const u = await signUp();
    const p1 = await create(u);
    const p2 = await create(u);
    for (let i = 0; i < 10; i++) {
      const results = await Promise.all([
        request(http()).post(`/diet-plans/${p1.id}/activate`).set(auth(u)),
        request(http()).post(`/diet-plans/${p2.id}/activate`).set(auth(u)),
      ]);
      expect(results.map((r) => r.status)).toEqual([200, 200]);
      expect(await activeIds(u.id)).toHaveLength(1);
    }
  });

  it('C14: sem token dá 401 em todas as rotas; corpo acima de 100 KB dá 413', async () => {
    const id = randomUUID();
    const calls = [
      () => request(http()).post('/diet-plans').send(minimal()),
      () => request(http()).get('/diet-plans'),
      () => request(http()).get(`/diet-plans/${id}`),
      () => request(http()).delete(`/diet-plans/${id}`),
      () => request(http()).post(`/diet-plans/${id}/activate`),
      () => request(http()).post(`/diet-plans/${id}/deactivate`),
    ];
    for (const call of calls) {
      expect((await call()).status).toBe(401);
    }

    const u = await signUp();
    const big = {
      ...minimal(),
      mealSlots: Array.from({ length: 3000 }, (_, i) => ({
        name: `Refeição número ${i} com nome longo`,
        order: i,
      })),
    };
    expect(JSON.stringify(big).length).toBeGreaterThan(100 * 1024);
    const res = await post(u, big);
    expect(res.status).toBe(413);
    expect(await countPlans(u.id)).toBe(0);
  });
});
