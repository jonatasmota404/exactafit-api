// Tarefa 13: registro de refeição (/meal-logs): criar (idempotente), ler, listar por dia, corrigir e apagar.
// Critérios C1–C17 do plano docs/plans/2026-11-23-registro-de-refeicao.md (removido no PR da 13b; ver o git).
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

describe('Registro de refeição (tarefa 13a)', () => {
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

  // Tarefa 13a-2: listagem por dia no fuso do perfil.
  describe('C9: GET /meal-logs?date= lista o dia no fuso do perfil', () => {
    const list = (u: User, query: string) =>
      request(http()).get(`/meal-logs${query}`).set(auth(u));
    const ids = async (u: User, date: string) => {
      const res = await list(u, `?date=${date}`);
      expect(res.status).toBe(200);
      return (res.body as Log[]).map((l) => l.id);
    };

    it('separa os dias no fuso do perfil, ordena por eatenAt e id, ignora outro usuário e muda com o fuso', async () => {
      const u = await signUp(); // perfil começa em America/Sao_Paulo
      const a = await arroz(u);
      const at = (eatenAt: string, id: string = randomUUID()) =>
        create(u, { ...body([{ foodId: a.id, grams: 100 }]), id, eatenAt });

      const prev = await at('2026-11-23T02:59:59Z'); // 23:59:59 do dia 22 em SP
      const l0 = await at('2026-11-23T03:00:00Z'); // 00:00 do dia 23 em SP
      const [idA, idB] = [randomUUID(), randomUUID()].sort();
      const l1b = await at('2026-11-23T12:00:00-03:00', idB); // mesmo eatenAt: desempata pelo id
      const l1a = await at('2026-11-23T12:00:00-03:00', idA);
      const l2 = await at('2026-11-23T23:30:00-03:00');
      const l3 = await at('2026-11-24T01:00:00Z'); // 22h do dia 23 em SP
      const next = await at('2026-11-24T03:00:00Z'); // 00:00 do dia 24 em SP

      const other = await signUp();
      const ao = await arroz(other);
      await create(other, {
        ...body([{ foodId: ao.id, grams: 100 }]),
        eatenAt: '2026-11-23T12:00:00-03:00',
      });

      expect(await ids(u, '2026-11-22')).toEqual([prev.id]);
      expect(await ids(u, '2026-11-23')).toEqual([
        l0.id,
        l1a.id,
        l1b.id,
        l3.id,
        l2.id,
      ]);
      expect(await ids(u, '2026-11-24')).toEqual([next.id]);

      // Cada registro sai no formato de C1, igual ao GET por id.
      const day = await list(u, '?date=2026-11-23');
      expect((day.body as Log[])[3]).toEqual((await getOne(u, l3.id)).body);

      await request(http())
        .patch('/me/profile')
        .set(auth(u))
        .send({ timezone: 'Asia/Tokyo' })
        .expect(200);
      expect(await ids(u, '2026-11-23')).toEqual([prev.id, l0.id]);
      expect(await ids(u, '2026-11-24')).toEqual([
        l1a.id,
        l1b.id,
        l3.id,
        l2.id,
        next.id,
      ]);
    });

    it('dia sem registro devolve lista vazia', async () => {
      const u = await signUp();
      expect(await ids(u, '2026-11-23')).toEqual([]);
    });

    it.each([
      ['date ausente', ''],
      ['date vazia', '?date='],
      ['data impossível', '?date=2026-02-30'],
      ['outro formato', '?date=23/11/2026'],
      ['sem zero à esquerda', '?date=2026-1-5'],
      ['com hora', '?date=2026-11-23T00:00:00Z'],
    ])('400: %s', async (_, query) => {
      const u = await signUp();
      expect((await list(u, query)).status).toBe(400);
    });

    it('sem token dá 401', async () => {
      await request(http()).get('/meal-logs?date=2026-11-23').expect(401);
    });
  });

  // Tarefa 13b: corrigir (PUT) e apagar (DELETE, com marcador de exclusão).
  describe('13b: corrigir e apagar', () => {
    const LOG_DELETED = 'Registro de refeição apagado';
    const put = (u: User, id: string, b: unknown) =>
      request(http())
        .put(`/meal-logs/${id}`)
        .set(auth(u))
        .send(b as object);
    const del = (u: User, id: string) =>
      request(http()).delete(`/meal-logs/${id}`).set(auth(u));
    const itemsOf = (id: string) =>
      count(
        'SELECT count(*)::int AS n FROM meal_log_items WHERE meal_log_id = $1',
        id,
      );
    const dayIds = async (u: User, date: string) => {
      const res = await request(http())
        .get(`/meal-logs?date=${date}`)
        .set(auth(u));
      expect(res.status).toBe(200);
      return (res.body as Log[]).map((l) => l.id);
    };
    // Corpo do PUT: o do POST sem o id.
    const putBody = (
      items: { foodId: string; grams: unknown }[],
      extra: Record<string, unknown> = {},
    ) => ({ eatenAt: '2026-11-23T20:00:00-03:00', items, ...extra });

    it('C12: PUT substitui eatenAt, refeição e itens, recalcula com o alimento atual e mantém o id (também em maiúsculas)', async () => {
      const u = await signUp();
      const plan = await createPlan(u);
      const [f, a] = [await frango(u), await arroz(u)];
      const extra = await createFood(u, 'Ovo', {
        kcal: 143,
        proteinG: 13,
        carbsG: 1,
        fatG: 10,
      });
      const log = await create(
        u,
        body(
          [
            { foodId: f.id, grams: 150 },
            { foodId: a.id, grams: 100 },
            { foodId: extra.id, grams: 50 },
          ],
          { mealSlotId: slot(plan, 'Almoço') },
        ),
      );
      expect(await itemsOf(log.id)).toBe(3);
      await request(http())
        .patch(`/foods/${f.id}`)
        .set(auth(u))
        .send({ kcal: 200 })
        .expect(200);

      const res = await put(
        u,
        log.id.toUpperCase(),
        putBody(
          [
            { foodId: a.id, grams: 200 },
            { foodId: f.id, grams: 100 },
          ],
          { mealSlotId: slot(plan, 'Jantar') },
        ),
      );
      expect(res.status).toBe(200);
      const updated = res.body as Log;
      expect(updated.id).toBe(log.id);
      expect(updated.eatenAt).toBe('2026-11-23T23:00:00.000Z');
      expect(updated.mealSlotId).toBe(slot(plan, 'Jantar'));
      expect(updated.mealSlotName).toBe('Jantar');
      expect(updated.mealTemplateId).toBeNull();
      expect(updated.items).toEqual([
        {
          foodId: a.id,
          name: a.name,
          state: 'COOKED',
          grams: '200',
          kcal: '260',
          proteinG: '5',
          carbsG: '56',
          fatG: '0.6',
          fiberG: null,
        },
        {
          foodId: f.id,
          name: f.name,
          state: 'COOKED',
          grams: '100',
          kcal: '200',
          proteinG: '32',
          carbsG: '0',
          fatG: '2.5',
          fiberG: null,
        },
      ]);
      expect(updated.totals).toEqual({
        kcal: '460',
        proteinG: '37',
        carbsG: '56',
        fatG: '3.1',
        fiberG: null,
      });
      expect(updated.createdAt).toBe(log.createdAt);
      expect(await itemsOf(log.id)).toBe(2);
      expect((await getOne(u, log.id)).body).toEqual(updated);
    });

    it('C13: PUT segue C7 e C8, recusa id no corpo e não altera nada no erro', async () => {
      const u = await signUp();
      const other = await signUp();
      const a = await arroz(u);
      const alheio = await arroz(other);
      const alheioPlan = await createPlan(other);
      const log = await create(u, body([{ foodId: a.id, grams: 100 }]));
      const ok = [{ foodId: a.id, grams: 150 }];

      const cases: [unknown, number, string?][] = [
        [{ ...putBody(ok), id: log.id }, 400],
        [putBody([]), 400],
        [
          putBody(ok, { mealSlotId: slot(alheioPlan, 'Almoço') }),
          400,
          SLOT_NOT_FOUND,
        ],
        [putBody([{ foodId: alheio.id, grams: 100 }]), 404, FOOD_NOT_FOUND],
      ];
      for (const [b, status, msg] of cases) {
        const res = await put(u, log.id, b);
        expect(res.status).toBe(status);
        if (msg) expect(message(res)).toBe(msg);
        expect((await getOne(u, log.id)).body).toEqual(log);
        expect(await itemsOf(log.id)).toBe(1);
      }
    });

    it('C14: DELETE dá 204; depois GET, PUT e outro DELETE dão 404 e o registro some da listagem; os itens ficam', async () => {
      const u = await signUp();
      const a = await arroz(u);
      const log = await create(u, body([{ foodId: a.id, grams: 100 }]));
      expect(await dayIds(u, '2026-11-23')).toEqual([log.id]);

      expect((await del(u, log.id.toUpperCase())).status).toBe(204);

      const got = await getOne(u, log.id);
      expect(got.status).toBe(404);
      expect(message(got)).toBe(LOG_NOT_FOUND);
      const putRes = await put(
        u,
        log.id,
        putBody([{ foodId: a.id, grams: 1 }]),
      );
      expect(putRes.status).toBe(404);
      expect(message(putRes)).toBe(LOG_NOT_FOUND);
      const again = await del(u, log.id);
      expect(again.status).toBe(404);
      expect(message(again)).toBe(LOG_NOT_FOUND);
      expect(await dayIds(u, '2026-11-23')).toEqual([]);
      expect(await logsWithId(log.id)).toBe(1);
      expect(await itemsOf(log.id)).toBe(1);
    });

    it('C15: reenvio do POST de um registro apagado: 410 para o dono, sem recriar; 409 para outro usuário', async () => {
      const u = await signUp();
      const other = await signUp();
      const a = await arroz(u);
      const b = body([{ foodId: a.id, grams: 100 }]);
      await create(u, b);
      expect((await del(u, b.id)).status).toBe(204);

      const mine = await post(u, b);
      expect(mine.status).toBe(410);
      expect(message(mine)).toBe(LOG_DELETED);
      expect(await logsWithId(b.id)).toBe(1);
      expect((await getOne(u, b.id)).status).toBe(404);

      const ao = await arroz(other);
      const theirs = await post(other, {
        ...body([{ foodId: ao.id, grams: 100 }]),
        id: b.id,
      });
      expect(theirs.status).toBe(409);
      expect(message(theirs)).toBe(LOG_EXISTS);
      expect(theirs.body).not.toHaveProperty('id');
      expect(await logsWithId(b.id)).toBe(1);
    });

    it('C16: PUT e DELETE em registro de outro usuário ou inexistente dão 404 e não alteram nada', async () => {
      const u = await signUp();
      const other = await signUp();
      const ao = await arroz(other);
      const theirs = await create(other, body([{ foodId: ao.id, grams: 100 }]));
      const a = await arroz(u);
      for (const id of [theirs.id, randomUUID()]) {
        const p = await put(u, id, putBody([{ foodId: a.id, grams: 1 }]));
        expect(p.status).toBe(404);
        expect(message(p)).toBe(LOG_NOT_FOUND);
        const d = await del(u, id);
        expect(d.status).toBe(404);
        expect(message(d)).toBe(LOG_NOT_FOUND);
      }
      expect((await getOne(other, theirs.id)).body).toEqual(theirs);
    });

    it('C17: PUT e DELETE do mesmo registro ao mesmo tempo: sem 500 e no fim apagado', async () => {
      const u = await signUp();
      const a = await arroz(u);
      for (let i = 0; i < 10; i++) {
        const log = await create(u, body([{ foodId: a.id, grams: 100 }]));
        const [p, d] = await Promise.all([
          put(u, log.id, putBody([{ foodId: a.id, grams: 200 }])),
          del(u, log.id),
        ]);
        expect(d.status).toBe(204);
        expect([200, 404]).toContain(p.status);
        expect((await getOne(u, log.id)).status).toBe(404);
      }
    });

    it('C17: PUT que reenvia a refeição e PATCH do plano que apaga a refeição ao mesmo tempo: sem 500', async () => {
      const u = await signUp();
      const a = await arroz(u);
      for (let i = 0; i < 10; i++) {
        const plan = await createPlan(u);
        const almoco = slot(plan, 'Almoço');
        const jantar = plan.mealSlots.find((m) => m.name === 'Jantar')!;
        const log = await create(
          u,
          body([{ foodId: a.id, grams: 100 }], { mealSlotId: almoco }),
        );
        const [p, patched] = await Promise.all([
          put(
            u,
            log.id,
            putBody([{ foodId: a.id, grams: 150 }], { mealSlotId: almoco }),
          ),
          request(http())
            .patch(`/diet-plans/${plan.id}`)
            .set(auth(u))
            .send({ mealSlots: [jantar] }),
        ]);
        expect(patched.status).toBe(200);
        const after = (await getOne(u, log.id)).body as Log;
        expect(after.mealSlotId).toBeNull();
        if (p.status === 200) {
          expect(after.items[0].grams).toBe('150');
        } else {
          expect(p.status).toBe(400);
          expect(message(p)).toBe(SLOT_NOT_FOUND);
          expect(after.items[0].grams).toBe('100');
        }
      }
    });

    // Sonda S1 do revisor: o PATCH apaga a refeição antiga (SET NULL trava o registro) e
    // renomeia a nova, que o PUT já travou. Uma terceira transação segura o registro para
    // forçar essa ordem e solta antes de o ciclo se fechar.
    it('C17: PUT para outra refeição e PATCH do plano que apaga a antiga e renomeia a nova: sem 500 (deadlock)', async () => {
      const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
      const u = await signUp();
      const a = await arroz(u);
      for (let i = 0; i < 3; i++) {
        const plan = await createPlan(u);
        const almoco = slot(plan, 'Almoço');
        const jantar = plan.mealSlots.find((m) => m.name === 'Jantar')!;
        const log = await create(
          u,
          body([{ foodId: a.id, grams: 100 }], { mealSlotId: almoco }),
        );
        const hold = prisma.$transaction(
          async (tx) => {
            await tx.$queryRawUnsafe(
              'SELECT 1 FROM meal_logs WHERE id = $1 FOR UPDATE',
              log.id,
            );
            await sleep(1500);
          },
          { timeout: 20000 },
        );
        await sleep(200);
        const patchP = request(http())
          .patch(`/diet-plans/${plan.id}`)
          .set(auth(u))
          .send({ mealSlots: [{ ...jantar, name: 'Ceia' }] })
          .then((r) => r);
        await sleep(400);
        const putP = put(
          u,
          log.id,
          putBody([{ foodId: a.id, grams: 150 }], { mealSlotId: jantar.id }),
        ).then((r) => r);
        await hold;
        const [patched, p] = await Promise.all([patchP, putP]);
        expect(patched.status).toBe(200);
        expect(p.status).toBe(200);
        const after = (await getOne(u, log.id)).body as Log;
        expect(after.items[0].grams).toBe('150');
        expect(after.mealSlotId).toBe(jantar.id);
      }
    }, 60000);

    it('C12: PUT troca a refeição modelo e atualiza updatedAt', async () => {
      const u = await signUp();
      const plan = await createPlan(u);
      const a = await arroz(u);
      const almoco = slot(plan, 'Almoço');
      const [t1, t2] = [
        await createTemplate(u, plan, almoco, a.id),
        await createTemplate(u, plan, almoco, a.id),
      ];
      const log = await create(
        u,
        body([{ foodId: a.id, grams: 100 }], {
          mealSlotId: almoco,
          mealTemplateId: t1,
        }),
      );
      const res = await put(
        u,
        log.id,
        putBody([{ foodId: a.id, grams: 100 }], {
          mealSlotId: almoco,
          mealTemplateId: t2,
        }),
      );
      expect(res.status).toBe(200);
      const updated = res.body as Log;
      expect(updated.mealTemplateId).toBe(t2);
      expect(updated.createdAt).toBe(log.createdAt);
      expect(Date.parse(updated.updatedAt)).toBeGreaterThan(
        Date.parse(log.updatedAt),
      );
    });
  });
});
