// Tarefa 13a-1: registro de refeição (/meal-logs): criar (idempotente) e ler.
// Plano: docs/plans/2026-11-23-registro-de-refeicao.md (C1–C8, C10, C11).
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { randomUUID } from 'crypto';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import type { Server } from 'http';

type User = { id: string; token: string };
type Food = { id: string; name: string; state: string };
type Plan = {
  id: string;
  mealSlots: { id: string; name: string; order: number }[];
};
type Item = {
  foodId: string | null;
  name: string;
  state: string;
  grams: string;
  kcal: string;
  proteinG: string;
  carbsG: string;
  fatG: string;
  fiberG: string | null;
};
type Log = {
  id: string;
  eatenAt: string;
  mealSlotId: string | null;
  mealSlotName: string | null;
  mealTemplateId: string | null;
  items: Item[];
  totals: Record<string, string | null>;
  createdAt: string;
  updatedAt: string;
};

const LOG_EXISTS = 'Registro de refeição já existe';
const LOG_NOT_FOUND = 'Registro de refeição não encontrado';
const SLOT_NOT_FOUND = 'Refeição não encontrada';
const TEMPLATE_NOT_IN_SLOT = 'Refeição modelo não pertence à refeição';
const FOOD_NOT_FOUND = 'Alimento não encontrado';
const REPEATED_FOOD = 'Alimento repetido';

describe('Registro de refeição (tarefa 13a-1)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const userIds: string[] = [];

  const http = () => app.getHttpServer() as Server;
  const auth = (u: User) => ({ Authorization: `Bearer ${u.token}` });
  const message = (res: request.Response) =>
    (res.body as { message: unknown }).message;

  const signUp = async (): Promise<User> => {
    const email = `ml13-${randomUUID()}@example.com`;
    const reg = await request(http())
      .post('/auth/register')
      .send({ name: 'Registro', email, password: 'password123' })
      .expect(201);
    const id = (reg.body as { id: string }).id;
    userIds.push(id);
    const login = await request(http())
      .post('/auth/login')
      .send({ email, password: 'password123' })
      .expect(201);
    return { id, token: (login.body as { accessToken: string }).accessToken };
  };

  const createPlan = async (u: User): Promise<Plan> => {
    const res = await request(http())
      .post('/diet-plans')
      .set(auth(u))
      .send({
        name: `Plano ${randomUUID()}`,
        mealSlots: [
          { name: 'Almoço', order: 1 },
          { name: 'Jantar', order: 2 },
        ],
        dayTypes: [{ name: 'Todos', order: 1, kcal: 2400 }],
        trainingDayTypeOrder: 1,
        restDayTypeOrder: 1,
      });
    expect(res.status).toBe(201);
    return res.body as Plan;
  };
  const slot = (plan: Plan, name: string) =>
    plan.mealSlots.find((m) => m.name === name)!.id;

  const createFood = async (
    u: User,
    name: string,
    v: Record<string, number>,
  ): Promise<Food> => {
    const res = await request(http())
      .post('/foods')
      .set(auth(u))
      .send({
        name: `${name} ${randomUUID().slice(0, 8)}`,
        state: 'COOKED',
        ...v,
      });
    expect(res.status).toBe(201);
    return res.body as Food;
  };
  const frango = (u: User) =>
    createFood(u, 'Frango', { kcal: 159, proteinG: 32, carbsG: 0, fatG: 2.5 });
  const arroz = (u: User) =>
    createFood(u, 'Arroz', { kcal: 130, proteinG: 2.5, carbsG: 28, fatG: 0.3 });

  const createTemplate = async (
    u: User,
    plan: Plan,
    slotId: string,
    foodId: string,
  ) => {
    const res = await request(http())
      .post(`/diet-plans/${plan.id}/meal-templates`)
      .set(auth(u))
      .send({
        mealSlotId: slotId,
        name: `Prato ${randomUUID().slice(0, 8)}`,
        order: Math.floor(Math.random() * 1e6),
        kind: 'COMPONENTS',
        components: [
          {
            name: 'P',
            targetType: 'WEIGHT',
            targetValue: 150,
            foodIds: [foodId],
          },
        ],
      });
    expect(res.status).toBe(201);
    return (res.body as { id: string }).id;
  };

  const body = (
    items: { foodId: string; grams: unknown }[],
    extra: Record<string, unknown> = {},
  ) => ({
    id: randomUUID(),
    eatenAt: '2026-11-23T12:30:00-03:00',
    items,
    ...extra,
  });
  const post = (u: User, b: unknown) =>
    request(http())
      .post('/meal-logs')
      .set(auth(u))
      .send(b as object);
  const create = async (u: User, b: unknown) => {
    const res = await post(u, b);
    expect(res.status).toBe(201);
    return res.body as Log;
  };
  const getOne = (u: User, id: string) =>
    request(http()).get(`/meal-logs/${id}`).set(auth(u));

  const count = async (sql: string, ...params: unknown[]) =>
    (await prisma.$queryRawUnsafe<{ n: number }[]>(sql, ...params))[0].n;
  const logsWithId = (id: string) =>
    count('SELECT count(*)::int AS n FROM meal_logs WHERE id = $1', id);
  const logsOf = (userId: string) =>
    count(
      'SELECT count(*)::int AS n FROM meal_logs WHERE user_id = $1',
      userId,
    );

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
      // Histórico sem cascade (ADR 0001): itens → registros, depois planos e alimentos.
      await prisma.$executeRawUnsafe(
        `DELETE FROM meal_log_items WHERE meal_log_id IN
           (SELECT id FROM meal_logs WHERE user_id = ANY($1::text[]))`,
        userIds,
      );
      await prisma.$executeRawUnsafe(
        'DELETE FROM meal_logs WHERE user_id = ANY($1::text[])',
        userIds,
      );
      await prisma.$executeRawUnsafe(
        'DELETE FROM diet_plans WHERE user_id = ANY($1::text[])',
        userIds,
      );
      await prisma.$executeRawUnsafe(
        'DELETE FROM foods WHERE user_id = ANY($1::text[])',
        userIds,
      );
    }
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    await prisma.$disconnect();
    await app.close();
  });

  it('C1: registra o almoço com refeição, refeição modelo e snapshot dos macros', async () => {
    const u = await signUp();
    const plan = await createPlan(u);
    const [f, a] = [await frango(u), await arroz(u)];
    const almoco = slot(plan, 'Almoço');
    const templateId = await createTemplate(u, plan, almoco, f.id);
    const b = body(
      [
        { foodId: f.id, grams: 150 },
        { foodId: a.id, grams: 100 },
      ],
      { mealSlotId: almoco, mealTemplateId: templateId },
    );
    const res = await post(u, b);
    expect(res.status).toBe(201);
    const log = res.body as Log & Record<string, unknown>;
    expect(Object.keys(log).sort()).toEqual(
      [
        'createdAt',
        'eatenAt',
        'id',
        'items',
        'mealSlotId',
        'mealSlotName',
        'mealTemplateId',
        'totals',
        'updatedAt',
      ].sort(),
    );
    expect(log).not.toHaveProperty('userId');
    expect(log.id).toBe(b.id);
    expect(log.eatenAt).toBe('2026-11-23T15:30:00.000Z');
    expect(log.mealSlotId).toBe(almoco);
    expect(log.mealSlotName).toBe('Almoço');
    expect(log.mealTemplateId).toBe(templateId);
    expect(log.items).toEqual([
      {
        foodId: f.id,
        name: f.name,
        state: 'COOKED',
        grams: '150',
        kcal: '238.5',
        proteinG: '48',
        carbsG: '0',
        fatG: '3.8',
        fiberG: null,
      },
      {
        foodId: a.id,
        name: a.name,
        state: 'COOKED',
        grams: '100',
        kcal: '130',
        proteinG: '2.5',
        carbsG: '28',
        fatG: '0.3',
        fiberG: null,
      },
    ]);
    expect(log.totals).toEqual({
      kcal: '368.5',
      proteinG: '50.5',
      carbsG: '28',
      fatG: '4.1',
      fiberG: null,
    });
  });

  it('C2: lanche fora do plano: sem refeição e sem refeição modelo', async () => {
    const u = await signUp();
    const a = await arroz(u);
    const log = await create(u, body([{ foodId: a.id, grams: 50 }]));
    expect(log.mealSlotId).toBeNull();
    expect(log.mealSlotName).toBeNull();
    expect(log.mealTemplateId).toBeNull();
    expect(log.totals.kcal).toBe('65');
  });

  it('C3: reenvio do mesmo id devolve o original sem alterar; id em maiúsculas vale o mesmo; id de outro usuário dá 409 sem dados', async () => {
    const u = await signUp();
    const other = await signUp();
    const [f, a] = [await frango(u), await arroz(u)];
    const b = body([{ foodId: f.id, grams: 150 }]);
    const original = await create(u, b);

    const again = await post(u, {
      ...b,
      eatenAt: '2026-11-20T08:00:00Z',
      items: [{ foodId: a.id, grams: 10 }],
    });
    expect(again.status).toBe(200);
    expect(again.body).toEqual(original);

    const upper = await post(u, { ...b, id: b.id.toUpperCase() });
    expect(upper.status).toBe(200);
    expect(upper.body).toEqual(original);
    expect(await logsWithId(b.id)).toBe(1);

    const fo = await frango(other);
    const alien = await post(other, {
      ...b,
      items: [{ foodId: fo.id, grams: 1 }],
    });
    expect(alien.status).toBe(409);
    expect(message(alien)).toBe(LOG_EXISTS);
    expect(JSON.stringify(alien.body)).not.toContain(f.id);
    expect(await logsOf(other.id)).toBe(0);
  });

  it('C4: dois POST com o mesmo id ao mesmo tempo: um 201 e um 200, um registro só', async () => {
    const u = await signUp();
    const a = await arroz(u);
    for (let i = 0; i < 10; i++) {
      const b = body([{ foodId: a.id, grams: 100 }]);
      const statuses = (await Promise.all([post(u, b), post(u, b)]))
        .map((r) => r.status)
        .sort();
      expect(statuses).toEqual([200, 201]);
      expect(await logsWithId(b.id)).toBe(1);
    }
  });

  it('C5: editar e apagar o alimento não muda o snapshot; foodId vira null', async () => {
    const u = await signUp();
    const f = await frango(u);
    const log = await create(u, body([{ foodId: f.id, grams: 150 }]));
    const patched = await request(http())
      .patch(`/foods/${f.id}`)
      .set(auth(u))
      .send({ kcal: 200, name: 'Frango novo' });
    expect(patched.status).toBe(200);
    expect((await getOne(u, log.id)).body).toEqual(log);
    expect(
      (await request(http()).delete(`/foods/${f.id}`).set(auth(u))).status,
    ).toBe(204);
    const after = (await getOne(u, log.id)).body as Log;
    expect(after.items).toEqual([{ ...log.items[0], foodId: null }]);
    expect(after.totals).toEqual(log.totals);
  });

  it('C6: apagar a refeição e o plano não apaga o registro; o nome da refeição fica', async () => {
    const u = await signUp();
    const plan = await createPlan(u);
    const [f, a] = [await frango(u), await arroz(u)];
    const almoco = slot(plan, 'Almoço');
    const templateId = await createTemplate(u, plan, almoco, f.id);
    const log = await create(
      u,
      body([{ foodId: a.id, grams: 100 }], {
        mealSlotId: almoco,
        mealTemplateId: templateId,
      }),
    );
    const jantar = plan.mealSlots.find((m) => m.name === 'Jantar')!;
    expect(
      (
        await request(http())
          .patch(`/diet-plans/${plan.id}`)
          .set(auth(u))
          .send({ mealSlots: [jantar] })
      ).status,
    ).toBe(200);
    const afterPatch = (await getOne(u, log.id)).body as Log;
    expect(afterPatch.mealSlotId).toBeNull();
    expect(afterPatch.mealTemplateId).toBeNull();
    expect(afterPatch.mealSlotName).toBe('Almoço');
    expect(afterPatch.items).toEqual(log.items);
    expect(
      (await request(http()).delete(`/diet-plans/${plan.id}`).set(auth(u)))
        .status,
    ).toBe(204);
    const afterDelete = await getOne(u, log.id);
    expect(afterDelete.status).toBe(200);
    expect(afterDelete.body).toEqual(afterPatch);
  });

  describe('C7: corpo inválido', () => {
    let u: User;
    let a: Food;
    beforeAll(async () => {
      u = await signUp();
      a = await arroz(u);
    });
    const cases: [string, (foodId: string) => Record<string, unknown>][] = [
      ['id ausente', () => ({ id: undefined })],
      ['id que não é uuid', () => ({ id: 'abc' })],
      ['eatenAt ausente', () => ({ eatenAt: undefined })],
      ['eatenAt sem fuso', () => ({ eatenAt: '2026-11-23T12:30:00' })],
      ['eatenAt só data', () => ({ eatenAt: '2026-11-23' })],
      [
        'eatenAt com data impossível',
        () => ({ eatenAt: '2026-02-30T12:00:00Z' }),
      ],
      [
        'eatenAt com ano UTC acima de 9999',
        () => ({ eatenAt: '9999-12-31T23:59:00-01:00' }),
      ],
      ['items ausente', () => ({ items: undefined })],
      ['items vazio', () => ({ items: [] })],
      ['grams negativo', (id) => ({ items: [{ foodId: id, grams: -1 }] })],
      ['grams com 2 casas', (id) => ({ items: [{ foodId: id, grams: 1.25 }] })],
      [
        'grams acima de 99999.9',
        (id) => ({ items: [{ foodId: id, grams: 100000 }] }),
      ],
      ['grams texto', (id) => ({ items: [{ foodId: id, grams: 'abc' }] })],
      [
        'foodId que não é uuid',
        () => ({ items: [{ foodId: 'abc', grams: 1 }] }),
      ],
      ['userId no corpo', () => ({ userId: randomUUID() })],
      ['campo desconhecido', () => ({ foo: 1 })],
      [
        'campo desconhecido no item',
        (id) => ({ items: [{ foodId: id, grams: 1, foo: 1 }] }),
      ],
    ];
    for (const [name, extra] of cases) {
      it(`400 e nada gravado: ${name}`, async () => {
        const before = await logsOf(u.id);
        const res = await post(
          u,
          body([{ foodId: a.id, grams: 100 }], extra(a.id)),
        );
        expect(res.status).toBe(400);
        expect(await logsOf(u.id)).toBe(before);
      });
    }
    it('400 "Alimento repetido" e nada gravado', async () => {
      const before = await logsOf(u.id);
      const res = await post(
        u,
        body([
          { foodId: a.id, grams: 100 },
          { foodId: a.id, grams: 50 },
        ]),
      );
      expect(res.status).toBe(400);
      expect(message(res)).toBe(REPEATED_FOOD);
      expect(await logsOf(u.id)).toBe(before);
    });
    it('201 na borda: grams 0 e 99999.9', async () => {
      const f = await frango(u);
      const log = await create(
        u,
        body([
          { foodId: a.id, grams: 0 },
          { foodId: f.id, grams: 99999.9 },
        ]),
      );
      expect(log.items.map((i) => i.grams)).toEqual(['0', '99999.9']);
      expect(log.items[0].kcal).toBe('0');
    });
  });

  it('C8: refeição alheia ou inexistente, refeição modelo sem refeição ou de outra refeição, alimento alheio ou inexistente', async () => {
    const u = await signUp();
    const other = await signUp();
    const plan = await createPlan(u);
    const alienPlan = await createPlan(other);
    const [f, a] = [await frango(u), await arroz(u)];
    const fo = await frango(other);
    const almoco = slot(plan, 'Almoço');
    const jantar = slot(plan, 'Jantar');
    const templateJantar = await createTemplate(u, plan, jantar, f.id);
    const items = [{ foodId: a.id, grams: 100 }];

    for (const mealSlotId of [slot(alienPlan, 'Almoço'), randomUUID()]) {
      const res = await post(u, body(items, { mealSlotId }));
      expect(res.status).toBe(400);
      expect(message(res)).toBe(SLOT_NOT_FOUND);
    }
    for (const extra of [
      { mealTemplateId: templateJantar },
      { mealSlotId: almoco, mealTemplateId: templateJantar },
      { mealSlotId: almoco, mealTemplateId: randomUUID() },
    ]) {
      const res = await post(u, body(items, extra));
      expect(res.status).toBe(400);
      expect(message(res)).toBe(TEMPLATE_NOT_IN_SLOT);
    }
    for (const foodId of [fo.id, randomUUID()]) {
      const res = await post(
        u,
        body([
          { foodId: a.id, grams: 10 },
          { foodId, grams: 10 },
        ]),
      );
      expect(res.status).toBe(404);
      expect(message(res)).toBe(FOOD_NOT_FOUND);
    }
    expect(await logsOf(u.id)).toBe(0);
  });

  it('C10: GET do próprio (também em maiúsculas) 200; alheio ou inexistente 404; id inválido 400', async () => {
    const u = await signUp();
    const other = await signUp();
    const a = await arroz(u);
    const log = await create(u, body([{ foodId: a.id, grams: 100 }]));
    const own = await getOne(u, log.id);
    expect(own.status).toBe(200);
    expect(own.body).toEqual(log);
    const upper = await getOne(u, log.id.toUpperCase());
    expect(upper.status).toBe(200);
    expect(upper.body).toEqual(log);
    for (const res of [
      await getOne(other, log.id),
      await getOne(u, randomUUID()),
    ]) {
      expect(res.status).toBe(404);
      expect(message(res)).toBe(LOG_NOT_FOUND);
    }
    expect((await getOne(u, 'abc')).status).toBe(400);
  });

  describe('C11: corridas, 401 e 413', () => {
    it('POST com um alimento e DELETE desse alimento ao mesmo tempo: sem 500 e estado coerente', async () => {
      const u = await signUp();
      for (let i = 0; i < 10; i++) {
        const f = await frango(u);
        const b = body([{ foodId: f.id, grams: 150 }]);
        const [created, deleted] = await Promise.all([
          post(u, b),
          request(http()).delete(`/foods/${f.id}`).set(auth(u)),
        ]);
        expect(deleted.status).toBe(204);
        if (created.status === 201) {
          const log = (await getOne(u, b.id)).body as Log;
          expect(log.items[0]).toMatchObject({
            name: f.name,
            kcal: '238.5',
            foodId: null,
          });
        } else {
          expect(created.status).toBe(404);
          expect(message(created)).toBe(FOOD_NOT_FOUND);
          expect(await logsWithId(b.id)).toBe(0);
        }
      }
    });

    it('POST numa refeição e PATCH do plano que apaga a refeição ao mesmo tempo: sem 500', async () => {
      const u = await signUp();
      const a = await arroz(u);
      for (let i = 0; i < 10; i++) {
        const plan = await createPlan(u);
        const jantar = plan.mealSlots.find((m) => m.name === 'Jantar')!;
        const b = body([{ foodId: a.id, grams: 100 }], {
          mealSlotId: slot(plan, 'Almoço'),
        });
        const [created, patched] = await Promise.all([
          post(u, b),
          request(http())
            .patch(`/diet-plans/${plan.id}`)
            .set(auth(u))
            .send({ mealSlots: [jantar] }),
        ]);
        expect(patched.status).toBe(200);
        if (created.status === 201) {
          const log = (await getOne(u, b.id)).body as Log;
          expect(log.mealSlotId).toBeNull();
          expect(log.mealSlotName).toBe('Almoço');
        } else {
          expect(created.status).toBe(400);
          expect(message(created)).toBe(SLOT_NOT_FOUND);
        }
      }
    });

    it('sem token dá 401; corpo acima de 100 KB dá 413', async () => {
      await request(http()).post('/meal-logs').send({}).expect(401);
      await request(http()).get(`/meal-logs/${randomUUID()}`).expect(401);
      const u = await signUp();
      const a = await arroz(u);
      const items = Array.from({ length: 2500 }, () => ({
        foodId: a.id,
        grams: 1,
      }));
      const b = body(items);
      expect(JSON.stringify(b).length).toBeGreaterThan(100 * 1024);
      const res = await post(u, b);
      expect(res.status).toBe(413);
      expect(await logsOf(u.id)).toBe(0);
    });
  });
});
