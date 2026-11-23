// Tarefa 11b-1: refeição modelo por componentes (/diet-plans/:id/meal-templates).
// Plano: docs/plans/2026-11-23-refeicao-modelo.md (C1–C12). C10 e C11 (DELETE /foods)
// ficam aqui, e não em foods.e2e-spec.ts, porque precisam de plano e refeição modelo.
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
type Option = { foodId: string; name: string; state: string };
type Component = {
  id: string;
  name: string;
  targetType: string;
  targetValue: string;
  options: Option[];
};
type Template = {
  id: string;
  mealSlotId: string;
  name: string;
  order: number;
  kind: string;
  components: Component[];
  items: unknown[];
  totals: unknown;
  createdAt: string;
  updatedAt: string;
};

const PLAN_NOT_FOUND = 'Plano de dieta não encontrado';
const TEMPLATE_NOT_FOUND = 'Refeição modelo não encontrada';
const FOOD_NOT_FOUND = 'Alimento não encontrado';
const SLOT_NOT_IN_PLAN = 'Refeição não pertence ao plano';
const ORDER_TAKEN = 'order já usado por outra refeição modelo desta refeição';
const REPEATED_FOOD = 'Alimento repetido';
const IN_TEMPLATE = 'Alimento em uso em refeição modelo';
const IN_YIELD = 'Alimento em uso em rendimento';
const noNutrient = (name: string) =>
  `Alimento sem o nutriente da meta: ${name}`;

describe('Refeição modelo (tarefa 11b-1)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const userIds: string[] = [];
  const catalogIds: string[] = [];

  const http = () => app.getHttpServer() as Server;
  const auth = (u: User) => ({ Authorization: `Bearer ${u.token}` });
  const message = (res: request.Response) =>
    (res.body as { message: unknown }).message;

  const signUp = async (): Promise<User> => {
    const email = `mt11b-${randomUUID()}@example.com`;
    const reg = await request(http())
      .post('/auth/register')
      .send({ name: 'Refeição modelo', email, password: 'password123' })
      .expect(201);
    const id = (reg.body as { id: string }).id;
    userIds.push(id);
    const login = await request(http())
      .post('/auth/login')
      .send({ email, password: 'password123' })
      .expect(201);
    return { id, token: (login.body as { accessToken: string }).accessToken };
  };

  // Plano com as refeições dadas (nome, order) e um tipo de dia.
  const createPlan = async (
    u: User,
    slots: [string, number][] = [
      ['Almoço', 1],
      ['Jantar', 2],
    ],
  ): Promise<Plan> => {
    const res = await request(http())
      .post('/diet-plans')
      .set(auth(u))
      .send({
        name: `Plano ${randomUUID()}`,
        mealSlots: slots.map(([name, order]) => ({ name, order })),
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
    values: { kcal: number; proteinG: number; carbsG: number; fatG: number },
    state = 'COOKED',
  ): Promise<Food> => {
    const res = await request(http())
      .post('/foods')
      .set(auth(u))
      .send({ name: `${name} ${randomUUID().slice(0, 8)}`, state, ...values });
    expect(res.status).toBe(201);
    return res.body as Food;
  };
  const frango = (u: User) =>
    createFood(u, 'Frango', { kcal: 159, proteinG: 32, carbsG: 0, fatG: 2.5 });
  const patinho = (u: User) =>
    createFood(u, 'Patinho', {
      kcal: 219,
      proteinG: 35.9,
      carbsG: 0,
      fatG: 7.3,
    });
  const arroz = (u: User) =>
    createFood(u, 'Arroz', { kcal: 130, proteinG: 2.5, carbsG: 28, fatG: 0.3 });
  const batata = (u: User) =>
    createFood(u, 'Batata', { kcal: 86, proteinG: 1.6, carbsG: 20, fatG: 0.1 });
  const oleo = (u: User) =>
    createFood(u, 'Óleo', { kcal: 884, proteinG: 0, carbsG: 0, fatG: 100 });
  const agua = (u: User) =>
    createFood(u, 'Água', { kcal: 0, proteinG: 0, carbsG: 0, fatG: 0 });

  const insertCatalog = async (name: string) => {
    const id = randomUUID();
    await prisma.$executeRawUnsafe(
      `INSERT INTO foods (id, name, state, kcal, protein_g, carbs_g, fat_g, tags, updated_at)
       VALUES ($1, $2, 'COOKED'::"FoodState", 130, 2.5, 28, 0.3, '{}'::"FoodTag"[], now())`,
      id,
      name,
    );
    catalogIds.push(id);
    return id;
  };

  // Corpo mínimo válido: um componente de peso com uma opção.
  const body = (
    mealSlotId: string,
    foodId: string,
    extra: Record<string, unknown> = {},
  ) => ({
    mealSlotId,
    name: `Prato ${randomUUID().slice(0, 8)}`,
    order: 1,
    kind: 'COMPONENTS',
    components: [
      {
        name: 'Proteína',
        targetType: 'WEIGHT',
        targetValue: 200,
        foodIds: [foodId],
      },
    ],
    ...extra,
  });

  const base = (planId: string) => `/diet-plans/${planId}/meal-templates`;
  const post = (u: User, planId: string, b: unknown) =>
    request(http())
      .post(base(planId))
      .set(auth(u))
      .send(b as object);
  const create = async (u: User, planId: string, b: unknown) => {
    const res = await post(u, planId, b);
    expect(res.status).toBe(201);
    return res.body as Template;
  };
  const list = (u: User, planId: string) =>
    request(http()).get(base(planId)).set(auth(u));
  const getOne = (u: User, planId: string, id: string) =>
    request(http())
      .get(`${base(planId)}/${id}`)
      .set(auth(u));
  const del = (u: User, planId: string, id: string) =>
    request(http())
      .delete(`${base(planId)}/${id}`)
      .set(auth(u));
  const delFood = (u: User, id: string) =>
    request(http()).delete(`/foods/${id}`).set(auth(u));
  const patchPlan = (u: User, planId: string, b: unknown) =>
    request(http())
      .patch(`/diet-plans/${planId}`)
      .set(auth(u))
      .send(b as object);

  const count = async (sql: string, ...params: unknown[]) =>
    (await prisma.$queryRawUnsafe<{ n: number }[]>(sql, ...params))[0].n;
  const templatesOfSlots = (slotIds: string[]) =>
    count(
      'SELECT count(*)::int AS n FROM meal_templates WHERE meal_slot_id = ANY($1::text[])',
      slotIds,
    );
  const templatesOfPlan = (plan: Plan) =>
    templatesOfSlots(plan.mealSlots.map((m) => m.id));
  const componentsOf = (templateId: string) =>
    count(
      'SELECT count(*)::int AS n FROM meal_template_components WHERE meal_template_id = $1',
      templateId,
    );
  const optionsOf = (componentIds: string[]) =>
    count(
      'SELECT count(*)::int AS n FROM meal_template_options WHERE component_id = ANY($1::text[])',
      componentIds,
    );
  const foodExists = async (id: string) =>
    (await count('SELECT count(*)::int AS n FROM foods WHERE id = $1', id)) ===
    1;

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
      // Planos primeiro: as refeições modelo saem em cascata e liberam os alimentos.
      await prisma.$executeRawUnsafe(
        'DELETE FROM diet_plans WHERE user_id = ANY($1::text[])',
        userIds,
      );
      await prisma.$executeRawUnsafe(
        'DELETE FROM food_yields WHERE user_id = ANY($1::text[])',
        userIds,
      );
      await prisma.$executeRawUnsafe(
        'DELETE FROM foods WHERE user_id = ANY($1::text[])',
        userIds,
      );
    }
    if (catalogIds.length) {
      await prisma.$executeRawUnsafe(
        'DELETE FROM foods WHERE id = ANY($1::text[])',
        catalogIds,
      );
    }
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    await prisma.$disconnect();
    await app.close();
  });

  it('C1: cria o prato do perfil A por componentes; formato, ordem e sem userId', async () => {
    const u = await signUp();
    const plan = await createPlan(u);
    const [f, p, a, b] = [
      await frango(u),
      await patinho(u),
      await arroz(u),
      await batata(u),
    ];
    const res = await post(u, plan.id, {
      mealSlotId: slot(plan, 'Almoço'),
      name: 'Prato padrão',
      order: 1,
      kind: 'COMPONENTS',
      components: [
        {
          name: 'Proteína',
          targetType: 'WEIGHT',
          targetValue: 200,
          foodIds: [f.id, p.id],
        },
        {
          name: 'Carboidrato',
          targetType: 'KCAL',
          targetValue: 190,
          foodIds: [b.id, a.id],
        },
      ],
    });
    expect(res.status).toBe(201);
    const t = res.body as Template & Record<string, unknown>;
    expect(Object.keys(t).sort()).toEqual(
      [
        'components',
        'createdAt',
        'id',
        'items',
        'kind',
        'mealSlotId',
        'name',
        'order',
        'totals',
        'updatedAt',
      ].sort(),
    );
    expect(t).not.toHaveProperty('userId');
    expect(t).toMatchObject({
      mealSlotId: slot(plan, 'Almoço'),
      name: 'Prato padrão',
      order: 1,
      kind: 'COMPONENTS',
      items: [],
      totals: null,
    });
    expect(t.components).toEqual([
      {
        id: expect.any(String) as string,
        name: 'Proteína',
        targetType: 'WEIGHT',
        targetValue: '200',
        options: [
          { foodId: f.id, name: f.name, state: 'COOKED' },
          { foodId: p.id, name: p.name, state: 'COOKED' },
        ],
      },
      {
        id: expect.any(String) as string,
        name: 'Carboidrato',
        targetType: 'KCAL',
        targetValue: '190',
        options: [
          { foodId: b.id, name: b.name, state: 'COOKED' },
          { foodId: a.id, name: a.name, state: 'COOKED' },
        ],
      },
    ]);
  });

  describe('C2: opção com 0 no nutriente da meta', () => {
    it('PROTEIN, CARBS e KCAL com nutriente 0 dão 400 e nada gravado; WEIGHT aceita', async () => {
      const u = await signUp();
      const plan = await createPlan(u);
      const [o, w] = [await oleo(u), await agua(u)];
      const s = slot(plan, 'Almoço');
      const cases: [string, Food][] = [
        ['PROTEIN', o],
        ['CARBS', o],
        ['KCAL', w],
      ];
      for (const [targetType, food] of cases) {
        const res = await post(u, plan.id, {
          ...body(s, food.id),
          components: [
            { name: 'C', targetType, targetValue: 50, foodIds: [food.id] },
          ],
        });
        expect(res.status).toBe(400);
        expect(message(res)).toBe(noNutrient(food.name));
      }
      expect(await templatesOfPlan(plan)).toBe(0);
      const ok = await post(u, plan.id, {
        ...body(s, w.id),
        components: [
          { name: 'C', targetType: 'WEIGHT', targetValue: 50, foodIds: [w.id] },
        ],
      });
      expect(ok.status).toBe(201);
    });
  });

  describe('C3: estrutura vazia', () => {
    const cases: [string, (foodId: string) => Record<string, unknown>][] = [
      ['components ausente', () => ({ components: undefined })],
      ['components: []', () => ({ components: [] })],
      [
        'componente com foodIds: []',
        () => ({
          components: [
            { name: 'C', targetType: 'WEIGHT', targetValue: 1, foodIds: [] },
          ],
        }),
      ],
    ];
    for (const [name, extra] of cases) {
      it(`400 e nada gravado: ${name}`, async () => {
        const u = await signUp();
        const plan = await createPlan(u);
        const f = await frango(u);
        const res = await post(
          u,
          plan.id,
          body(slot(plan, 'Almoço'), f.id, extra(f.id)),
        );
        expect(res.status).toBe(400);
        expect(await templatesOfPlan(plan)).toBe(0);
      });
    }
  });

  describe('C4: corpo inválido', () => {
    let u: User;
    let plan: Plan;
    let f: Food;
    let s: string;
    beforeAll(async () => {
      u = await signUp();
      plan = await createPlan(u);
      f = await frango(u);
      s = slot(plan, 'Almoço');
    });
    const comp = (c: Record<string, unknown>) => (foodId: string) => ({
      components: [
        {
          name: 'C',
          targetType: 'WEIGHT',
          targetValue: 10,
          foodIds: [foodId],
          ...c,
        },
      ],
    });
    const cases: [string, (foodId: string) => Record<string, unknown>][] = [
      ['kind desconhecido', () => ({ kind: 'OUTRO' })],
      [
        'COMPONENTS com items',
        (id) => ({ items: [{ foodId: id, grams: 100 }] }),
      ],
      ['targetType desconhecido', comp({ targetType: 'FAT' })],
      ['targetValue negativo', comp({ targetValue: -1 })],
      ['targetValue com 2 casas', comp({ targetValue: 1.25 })],
      ['targetValue acima de 99999.9', comp({ targetValue: 100000 })],
      ['targetValue texto', comp({ targetValue: 'abc' })],
      ['name vazio', () => ({ name: '' })],
      ['name com 101 caracteres', () => ({ name: 'a'.repeat(101) })],
      ['name com byte nulo', () => ({ name: 'a\u0000b' })],
      ['nome do componente vazio', comp({ name: '' })],
      [
        'nome do componente com 101 caracteres',
        comp({ name: 'a'.repeat(101) }),
      ],
      ['nome do componente com byte nulo', comp({ name: 'a\u0000b' })],
      ['order negativo', () => ({ order: -1 })],
      ['order fracionário', () => ({ order: 1.5 })],
      ['order acima de 2147483647', () => ({ order: 2147483648 })],
      ['mealSlotId que não é uuid', () => ({ mealSlotId: 'abc' })],
      ['foodIds com item que não é uuid', comp({ foodIds: ['abc'] })],
      ['userId no corpo', () => ({ userId: randomUUID() })],
      ['campo desconhecido', () => ({ foo: 1 })],
      ['campo desconhecido no componente', comp({ foo: 1 })],
    ];
    for (const [name, extra] of cases) {
      it(`400 e nada gravado: ${name}`, async () => {
        const res = await post(u, plan.id, body(s, f.id, extra(f.id)));
        expect(res.status).toBe(400);
        expect(await templatesOfPlan(plan)).toBe(0);
      });
    }
    it('400 "Alimento repetido" e nada gravado: mesmo alimento duas vezes nas opções', async () => {
      const res = await post(
        u,
        plan.id,
        body(s, f.id, comp({ foodIds: [f.id, f.id] })(f.id)),
      );
      expect(res.status).toBe(400);
      expect(message(res)).toBe(REPEATED_FOOD);
      expect(await templatesOfPlan(plan)).toBe(0);
    });
    it('201 na borda: targetValue 0 e 99999.9; mesmo alimento em componentes diferentes', async () => {
      const u2 = await signUp();
      const plan2 = await createPlan(u2);
      const f2 = await frango(u2);
      const s2 = slot(plan2, 'Almoço');
      const res = await post(u2, plan2.id, {
        ...body(s2, f2.id),
        components: [
          { name: 'A', targetType: 'WEIGHT', targetValue: 0, foodIds: [f2.id] },
          {
            name: 'B',
            targetType: 'WEIGHT',
            targetValue: 99999.9,
            foodIds: [f2.id],
          },
        ],
      });
      expect(res.status).toBe(201);
      const t = res.body as Template;
      expect(t.components.map((c) => c.targetValue)).toEqual(['0', '99999.9']);
    });
  });

  it('C5: refeição de fora do plano dá 400; order repetido na mesma refeição dá 400; em outra refeição, 201', async () => {
    const u = await signUp();
    const other = await signUp();
    const plan = await createPlan(u);
    const plan2 = await createPlan(u);
    const alien = await createPlan(other);
    const f = await frango(u);
    for (const mealSlotId of [
      slot(plan2, 'Almoço'),
      slot(alien, 'Almoço'),
      randomUUID(),
    ]) {
      const res = await post(u, plan.id, body(mealSlotId, f.id));
      expect(res.status).toBe(400);
      expect(message(res)).toBe(SLOT_NOT_IN_PLAN);
    }
    expect(await templatesOfPlan(plan)).toBe(0);
    await create(u, plan.id, body(slot(plan, 'Almoço'), f.id, { order: 7 }));
    const dup = await post(
      u,
      plan.id,
      body(slot(plan, 'Almoço'), f.id, { order: 7 }),
    );
    expect(dup.status).toBe(400);
    expect(message(dup)).toBe(ORDER_TAKEN);
    expect(await templatesOfPlan(plan)).toBe(1);
    const otherSlot = await post(
      u,
      plan.id,
      body(slot(plan, 'Jantar'), f.id, { order: 7 }),
    );
    expect(otherSlot.status).toBe(201);
  });

  it('C6: alimento alheio ou inexistente dá 404; do catálogo e próprio, 201', async () => {
    const u = await signUp();
    const other = await signUp();
    const plan = await createPlan(u);
    const mine = await frango(u);
    const theirs = await frango(other);
    const s = slot(plan, 'Almoço');
    for (const foodId of [theirs.id, randomUUID()]) {
      const res = await post(
        u,
        plan.id,
        body(s, mine.id, {
          components: [
            {
              name: 'C',
              targetType: 'WEIGHT',
              targetValue: 10,
              foodIds: [mine.id, foodId],
            },
          ],
        }),
      );
      expect(res.status).toBe(404);
      expect(message(res)).toBe(FOOD_NOT_FOUND);
    }
    expect(await templatesOfPlan(plan)).toBe(0);
    const catalog = await insertCatalog(`Arroz catálogo 11b ${randomUUID()}`);
    const ok = await post(
      u,
      plan.id,
      body(s, mine.id, {
        components: [
          {
            name: 'C',
            targetType: 'KCAL',
            targetValue: 190,
            foodIds: [catalog, mine.id],
          },
        ],
      }),
    );
    expect(ok.status).toBe(201);
  });

  it('C7: lista só as do plano, pela order da refeição, da refeição modelo e id; GET de uma devolve o mesmo corpo', async () => {
    const u = await signUp();
    const plan = await createPlan(u, [
      ['Almoço', 2],
      ['Café', 1],
    ]);
    const outro = await createPlan(u);
    const f = await frango(u);
    const almoco = slot(plan, 'Almoço');
    const cafe = slot(plan, 'Café');
    const a5 = await create(
      u,
      plan.id,
      body(almoco, f.id, { name: 'A5', order: 5 }),
    );
    const c9 = await create(
      u,
      plan.id,
      body(cafe, f.id, { name: 'C9', order: 9 }),
    );
    const a1 = await create(
      u,
      plan.id,
      body(almoco, f.id, { name: 'A1', order: 1 }),
    );
    const c3 = await create(
      u,
      plan.id,
      body(cafe, f.id, { name: 'C3', order: 3 }),
    );
    await create(
      u,
      outro.id,
      body(slot(outro, 'Almoço'), f.id, { name: 'Outro' }),
    );
    const res = await list(u, plan.id);
    expect(res.status).toBe(200);
    expect((res.body as Template[]).map((t) => t.name)).toEqual([
      'C3',
      'C9',
      'A1',
      'A5',
    ]);
    expect(res.body).toEqual([c3, c9, a1, a5]);
    const one = await getOne(u, plan.id, a5.id);
    expect(one.status).toBe(200);
    expect(one.body).toEqual(a5);
  });

  it('C8: plano alheio ou inexistente dá 404; refeição modelo de outro plano ou inexistente dá 404; id inválido dá 400', async () => {
    const u = await signUp();
    const other = await signUp();
    const plan = await createPlan(u);
    const plan2 = await createPlan(u);
    const alien = await createPlan(other);
    const f = await frango(u);
    const fo = await frango(other);
    const t = await create(u, plan.id, body(slot(plan, 'Almoço'), f.id));
    const ta = await create(
      other,
      alien.id,
      body(slot(alien, 'Almoço'), fo.id),
    );
    for (const planId of [alien.id, randomUUID()]) {
      for (const res of [
        await post(u, planId, body(slot(alien, 'Almoço'), f.id)),
        await list(u, planId),
        await getOne(u, planId, ta.id),
        await del(u, planId, ta.id),
      ]) {
        expect(res.status).toBe(404);
        expect(message(res)).toBe(PLAN_NOT_FOUND);
      }
    }
    for (const id of [t.id, randomUUID()]) {
      for (const res of [
        await getOne(u, plan2.id, id),
        await del(u, plan2.id, id),
      ]) {
        expect(res.status).toBe(404);
        expect(message(res)).toBe(TEMPLATE_NOT_FOUND);
      }
    }
    expect((await getOne(u, plan.id, t.id)).status).toBe(200);
    expect((await getOne(other, alien.id, ta.id)).status).toBe(200);
    expect((await list(u, 'abc')).status).toBe(400);
    expect(
      (await post(u, 'abc', body(slot(plan, 'Almoço'), f.id))).status,
    ).toBe(400);
    expect((await getOne(u, plan.id, 'abc')).status).toBe(400);
    expect((await del(u, plan.id, 'abc')).status).toBe(400);
  });

  describe('C9: apagar a refeição modelo, a refeição ou o plano', () => {
    it('DELETE da refeição modelo: 204, componentes e opções saem, alimentos ficam', async () => {
      const u = await signUp();
      const plan = await createPlan(u);
      const f = await frango(u);
      const t = await create(u, plan.id, body(slot(plan, 'Almoço'), f.id));
      const componentIds = t.components.map((c) => c.id);
      expect(await optionsOf(componentIds)).toBe(1);
      expect((await del(u, plan.id, t.id)).status).toBe(204);
      expect(await templatesOfPlan(plan)).toBe(0);
      expect(await componentsOf(t.id)).toBe(0);
      expect(await optionsOf(componentIds)).toBe(0);
      expect((await getOne(u, plan.id, t.id)).status).toBe(404);
      expect(await foodExists(f.id)).toBe(true);
    });

    it('PATCH do plano que omite a refeição apaga as refeições modelo dela', async () => {
      const u = await signUp();
      const plan = await createPlan(u);
      const f = await frango(u);
      const t = await create(u, plan.id, body(slot(plan, 'Almoço'), f.id));
      const jantar = plan.mealSlots.find((m) => m.name === 'Jantar')!;
      const res = await patchPlan(u, plan.id, { mealSlots: [jantar] });
      expect(res.status).toBe(200);
      expect(await templatesOfSlots([slot(plan, 'Almoço')])).toBe(0);
      expect(await componentsOf(t.id)).toBe(0);
      expect(await foodExists(f.id)).toBe(true);
    });

    it('PATCH do plano que reenvia a refeição sem id apaga as refeições modelo dela', async () => {
      const u = await signUp();
      const plan = await createPlan(u);
      const f = await frango(u);
      const t = await create(u, plan.id, body(slot(plan, 'Almoço'), f.id));
      const res = await patchPlan(u, plan.id, {
        mealSlots: plan.mealSlots.map((m) =>
          m.name === 'Almoço' ? { name: m.name, order: m.order } : m,
        ),
      });
      expect(res.status).toBe(200);
      expect(await templatesOfSlots([slot(plan, 'Almoço')])).toBe(0);
      expect(await componentsOf(t.id)).toBe(0);
      expect(await foodExists(f.id)).toBe(true);
    });

    it('DELETE do plano apaga as refeições modelo', async () => {
      const u = await signUp();
      const plan = await createPlan(u);
      const f = await frango(u);
      const t = await create(u, plan.id, body(slot(plan, 'Almoço'), f.id));
      const res = await request(http())
        .delete(`/diet-plans/${plan.id}`)
        .set(auth(u));
      expect(res.status).toBe(204);
      expect(await templatesOfPlan(plan)).toBe(0);
      expect(await componentsOf(t.id)).toBe(0);
      expect(await foodExists(f.id)).toBe(true);
    });
  });

  describe('C10: DELETE /foods de alimento em refeição modelo', () => {
    it('409 enquanto é opção; 204 depois de apagar a refeição modelo', async () => {
      const u = await signUp();
      const plan = await createPlan(u);
      const f = await frango(u);
      const t = await create(u, plan.id, body(slot(plan, 'Almoço'), f.id));
      const res = await delFood(u, f.id);
      expect(res.status).toBe(409);
      expect(message(res)).toBe(IN_TEMPLATE);
      expect(await foodExists(f.id)).toBe(true);
      expect((await del(u, plan.id, t.id)).status).toBe(204);
      expect((await delFood(u, f.id)).status).toBe(204);
    });

    it('alimento em rendimento e em refeição modelo: 409 do rendimento (precedência)', async () => {
      const u = await signUp();
      const plan = await createPlan(u);
      const raw = await createFood(
        u,
        'Arroz cru',
        {
          kcal: 360,
          proteinG: 7,
          carbsG: 79,
          fatG: 0.6,
        },
        'RAW',
      );
      const cooked = await arroz(u);
      const y = await request(http())
        .post('/food-yields')
        .set(auth(u))
        .send({ rawFoodId: raw.id, cookedFoodId: cooked.id, factor: 2.5 });
      expect(y.status).toBe(201);
      await create(u, plan.id, body(slot(plan, 'Almoço'), raw.id));
      const res = await delFood(u, raw.id);
      expect(res.status).toBe(409);
      expect(message(res)).toBe(IN_YIELD);
    });
  });

  it('C11: POST de refeição modelo e DELETE do alimento ao mesmo tempo: nenhum 500 e estado coerente', async () => {
    const u = await signUp();
    const plan = await createPlan(u);
    const s = slot(plan, 'Almoço');
    for (let i = 0; i < 10; i++) {
      const f = await frango(u);
      const [created, deleted] = await Promise.all([
        post(u, plan.id, body(s, f.id, { order: i })),
        delFood(u, f.id),
      ]);
      if (created.status === 201) {
        expect(deleted.status).toBe(409);
        expect(message(deleted)).toBe(IN_TEMPLATE);
        expect(await foodExists(f.id)).toBe(true);
      } else {
        expect(created.status).toBe(404);
        expect(message(created)).toBe(FOOD_NOT_FOUND);
        expect(deleted.status).toBe(204);
        expect(await foodExists(f.id)).toBe(false);
      }
    }
  });

  describe('C12: corridas com o plano, 401 e 413', () => {
    it('POST de refeição modelo e PATCH do plano que apaga a refeição: nenhum 500 e nada pendurado', async () => {
      const u = await signUp();
      const f = await frango(u);
      for (let i = 0; i < 10; i++) {
        const plan = await createPlan(u);
        const jantar = plan.mealSlots.find((m) => m.name === 'Jantar')!;
        const [created, patched] = await Promise.all([
          post(u, plan.id, body(slot(plan, 'Almoço'), f.id)),
          patchPlan(u, plan.id, { mealSlots: [jantar] }),
        ]);
        expect(patched.status).toBe(200);
        expect([201, 400]).toContain(created.status);
        expect(await templatesOfSlots([slot(plan, 'Almoço')])).toBe(0);
      }
    });

    it('POST de refeição modelo e DELETE do plano: nenhum 500 e nada pendurado', async () => {
      const u = await signUp();
      const f = await frango(u);
      for (let i = 0; i < 10; i++) {
        const plan = await createPlan(u);
        const [created, deleted] = await Promise.all([
          post(u, plan.id, body(slot(plan, 'Almoço'), f.id)),
          request(http()).delete(`/diet-plans/${plan.id}`).set(auth(u)),
        ]);
        expect(deleted.status).toBe(204);
        expect([201, 404]).toContain(created.status);
        expect(await templatesOfPlan(plan)).toBe(0);
      }
    });

    it('sem token, todas as rotas dão 401', async () => {
      const planId = randomUUID();
      const id = randomUUID();
      await request(http()).get(base(planId)).expect(401);
      await request(http())
        .get(`${base(planId)}/${id}`)
        .expect(401);
      await request(http()).post(base(planId)).send({}).expect(401);
      await request(http())
        .delete(`${base(planId)}/${id}`)
        .expect(401);
    });

    it('corpo acima de 100 KB dá 413', async () => {
      const u = await signUp();
      const plan = await createPlan(u);
      const f = await frango(u);
      const components = Array.from({ length: 1500 }, (_, i) => ({
        name: `Componente ${i} ${'x'.repeat(40)}`,
        targetType: 'WEIGHT',
        targetValue: 10,
        foodIds: [f.id],
      }));
      const b = body(slot(plan, 'Almoço'), f.id, { components });
      expect(JSON.stringify(b).length).toBeGreaterThan(100 * 1024);
      const res = await post(u, plan.id, b);
      expect(res.status).toBe(413);
      expect(await templatesOfPlan(plan)).toBe(0);
    });
  });

  // Tarefa 11b-2: composição livre (C13–C16).
  describe('11b-2: composição livre', () => {
    const food = async (
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
    // Ovo sem fibra; aveia com fibra.
    const ovo = (u: User) =>
      food(u, 'Ovo', { kcal: 143, proteinG: 12.6, carbsG: 0.7, fatG: 9.5 });
    const aveia = (u: User) =>
      food(u, 'Aveia', {
        kcal: 394,
        proteinG: 13.9,
        carbsG: 66.6,
        fatG: 8.5,
        fiberG: 9.1,
      });
    const free = (
      mealSlotId: string,
      items: { foodId: string; grams: unknown }[],
      extra: Record<string, unknown> = {},
    ) => ({
      mealSlotId,
      name: `Livre ${randomUUID().slice(0, 8)}`,
      order: 1,
      kind: 'FREE',
      items,
      ...extra,
    });
    const itemsOf = (templateId: string) =>
      count(
        'SELECT count(*)::int AS n FROM meal_template_items WHERE meal_template_id = $1',
        templateId,
      );

    it('C13: ovo 100 g + aveia 30 g → 201 com itens e totals somados (1 casa, meio para cima); fibra só de quem tem', async () => {
      const u = await signUp();
      const plan = await createPlan(u);
      const [o, a] = [await ovo(u), await aveia(u)];
      const res = await post(
        u,
        plan.id,
        free(slot(plan, 'Almoço'), [
          { foodId: o.id, grams: 100 },
          { foodId: a.id, grams: 30 },
        ]),
      );
      expect(res.status).toBe(201);
      const t = res.body as Template & Record<string, unknown>;
      expect(Object.keys(t).sort()).toEqual(
        [
          'components',
          'createdAt',
          'id',
          'items',
          'kind',
          'mealSlotId',
          'name',
          'order',
          'totals',
          'updatedAt',
        ].sort(),
      );
      expect(t.kind).toBe('FREE');
      expect(t.components).toEqual([]);
      expect(t.items).toEqual([
        { foodId: o.id, name: o.name, state: 'COOKED', grams: '100' },
        { foodId: a.id, name: a.name, state: 'COOKED', grams: '30' },
      ]);
      // kcal 143 + 118.2; proteína 12.6 + 4.17; carbo 0.7 + 19.98;
      // gordura 9.5 + 2.55 = 12.05 → 12.1; fibra só da aveia: 2.73.
      expect(t.totals).toEqual({
        kcal: '261.2',
        proteinG: '16.8',
        carbsG: '20.7',
        fatG: '12.1',
        fiberG: '2.7',
      });
      expect((await getOne(u, plan.id, t.id)).body).toEqual(t);
    });

    it('C13: sem nenhum alimento com fibra → fiberG null', async () => {
      const u = await signUp();
      const plan = await createPlan(u);
      const o = await ovo(u);
      const t = await create(
        u,
        plan.id,
        free(slot(plan, 'Almoço'), [{ foodId: o.id, grams: 100 }]),
      );
      expect(t.totals).toEqual({
        kcal: '143',
        proteinG: '12.6',
        carbsG: '0.7',
        fatG: '9.5',
        fiberG: null,
      });
    });

    describe('C14: corpo inválido na composição livre', () => {
      let u: User;
      let plan: Plan;
      let o: Food;
      let s: string;
      beforeAll(async () => {
        u = await signUp();
        plan = await createPlan(u);
        o = await ovo(u);
        s = slot(plan, 'Almoço');
      });
      const cases: [string, (foodId: string) => Record<string, unknown>][] = [
        ['items ausente', () => ({ items: undefined })],
        ['items: []', () => ({ items: [] })],
        [
          'FREE com components',
          (id) => ({
            components: [
              {
                name: 'C',
                targetType: 'WEIGHT',
                targetValue: 1,
                foodIds: [id],
              },
            ],
          }),
        ],
        ['grams negativo', (id) => ({ items: [{ foodId: id, grams: -1 }] })],
        [
          'grams com 2 casas',
          (id) => ({ items: [{ foodId: id, grams: 1.25 }] }),
        ],
        [
          'grams acima de 99999.9',
          (id) => ({ items: [{ foodId: id, grams: 100000 }] }),
        ],
        ['grams texto', (id) => ({ items: [{ foodId: id, grams: 'abc' }] })],
        [
          'foodId que não é uuid',
          () => ({ items: [{ foodId: 'abc', grams: 1 }] }),
        ],
        [
          'campo desconhecido no item',
          (id) => ({ items: [{ foodId: id, grams: 1, foo: 1 }] }),
        ],
      ];
      for (const [name, extra] of cases) {
        it(`400 e nada gravado: ${name}`, async () => {
          const res = await post(u, plan.id, {
            ...free(s, [{ foodId: o.id, grams: 100 }]),
            ...extra(o.id),
          });
          expect(res.status).toBe(400);
          expect(await templatesOfPlan(plan)).toBe(0);
        });
      }
      it('400 "Alimento repetido": mesmo alimento duas vezes nos itens', async () => {
        const res = await post(
          u,
          plan.id,
          free(s, [
            { foodId: o.id, grams: 100 },
            { foodId: o.id, grams: 50 },
          ]),
        );
        expect(res.status).toBe(400);
        expect(message(res)).toBe(REPEATED_FOOD);
        expect(await templatesOfPlan(plan)).toBe(0);
      });
      it('404 "Alimento não encontrado": alimento alheio ou inexistente num item', async () => {
        const other = await signUp();
        const theirs = await ovo(other);
        for (const foodId of [theirs.id, randomUUID()]) {
          const res = await post(
            u,
            plan.id,
            free(s, [
              { foodId: o.id, grams: 100 },
              { foodId, grams: 10 },
            ]),
          );
          expect(res.status).toBe(404);
          expect(message(res)).toBe(FOOD_NOT_FOUND);
        }
        expect(await templatesOfPlan(plan)).toBe(0);
      });
      it('201 na borda: grams 0 e 99999.9', async () => {
        const u2 = await signUp();
        const plan2 = await createPlan(u2);
        const [o2, a2] = [await ovo(u2), await aveia(u2)];
        const t = await create(
          u2,
          plan2.id,
          free(slot(plan2, 'Almoço'), [
            { foodId: o2.id, grams: 0 },
            { foodId: a2.id, grams: 99999.9 },
          ]),
        );
        expect(t.items.map((i) => (i as { grams: string }).grams)).toEqual([
          '0',
          '99999.9',
        ]);
      });
    });

    it('C15: DELETE /foods de alimento em item livre → 409; 204 depois de apagar a refeição modelo', async () => {
      const u = await signUp();
      const plan = await createPlan(u);
      const o = await ovo(u);
      const t = await create(
        u,
        plan.id,
        free(slot(plan, 'Almoço'), [{ foodId: o.id, grams: 100 }]),
      );
      const res = await delFood(u, o.id);
      expect(res.status).toBe(409);
      expect(message(res)).toBe(IN_TEMPLATE);
      expect(await foodExists(o.id)).toBe(true);
      expect((await del(u, plan.id, t.id)).status).toBe(204);
      expect((await delFood(u, o.id)).status).toBe(204);
    });

    it('C16: DELETE da refeição modelo livre, PATCH que apaga a refeição e DELETE do plano apagam os itens', async () => {
      const u = await signUp();
      const o = await ovo(u);
      const items = [{ foodId: o.id, grams: 100 }];

      const p1 = await createPlan(u);
      const t1 = await create(u, p1.id, free(slot(p1, 'Almoço'), items));
      expect(await itemsOf(t1.id)).toBe(1);
      expect((await del(u, p1.id, t1.id)).status).toBe(204);
      expect(await itemsOf(t1.id)).toBe(0);

      const p2 = await createPlan(u);
      const t2 = await create(u, p2.id, free(slot(p2, 'Almoço'), items));
      const jantar = p2.mealSlots.find((m) => m.name === 'Jantar')!;
      expect((await patchPlan(u, p2.id, { mealSlots: [jantar] })).status).toBe(
        200,
      );
      expect(await itemsOf(t2.id)).toBe(0);

      const p3 = await createPlan(u);
      const t3 = await create(u, p3.id, free(slot(p3, 'Almoço'), items));
      expect(
        (await request(http()).delete(`/diet-plans/${p3.id}`).set(auth(u)))
          .status,
      ).toBe(204);
      expect(await itemsOf(t3.id)).toBe(0);
      expect(await foodExists(o.id)).toBe(true);
    });
  });
});
