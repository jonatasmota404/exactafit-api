// Tarefa 10b-1: rendimento cru → pronto (FoodYield) e o 409 em /foods (A6).
// Plano: docs/plans/2026-11-12-rendimento-e-csv.md (C1–C12).
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { randomUUID } from 'crypto';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import type { Server } from 'http';

type User = { id: string; token: string };
type Ref = { id: string; name: string };
type Yield = {
  id: string;
  factor: string;
  rawFood: Ref;
  cookedFood: Ref;
  createdAt: string;
  updatedAt: string;
};

const FOOD_NOT_FOUND = 'Alimento não encontrado';
const YIELD_NOT_FOUND = 'Rendimento não encontrado';
const DUPLICATE = 'Rendimento já existe para este par';
const IN_USE = 'Alimento em uso em rendimento';

describe('Rendimento (tarefa 10b-1)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const userIds: string[] = [];
  const catalogIds: string[] = [];

  const http = () => app.getHttpServer() as Server;
  const auth = (u: User) => ({ Authorization: `Bearer ${u.token}` });

  const signUp = async (): Promise<User> => {
    const email = `yields10b-${randomUUID()}@example.com`;
    const reg = await request(http())
      .post('/auth/register')
      .send({ name: 'Rendimento', email, password: 'password123' })
      .expect(201);
    const id = (reg.body as { id: string }).id;
    userIds.push(id);
    const login = await request(http())
      .post('/auth/login')
      .send({ email, password: 'password123' })
      .expect(201);
    return { id, token: (login.body as { accessToken: string }).accessToken };
  };

  const food = async (u: User, state: 'RAW' | 'COOKED', name?: string) => {
    const res = await request(http())
      .post('/foods')
      .set(auth(u))
      .send({
        name: name ?? `${state} ${randomUUID()}`,
        state,
        kcal: 130,
        proteinG: 2.5,
        carbsG: 28,
        fatG: 0.3,
      });
    expect(res.status).toBe(201);
    return res.body as Ref & { state: string };
  };

  const insertCatalog = async (state: 'RAW' | 'COOKED') => {
    const id = randomUUID();
    const name = `Catálogo ${state} ${id}`;
    await prisma.$executeRawUnsafe(
      `INSERT INTO foods (id, name, state, kcal, protein_g, carbs_g, fat_g, updated_at)
       VALUES ($1, $2, $3::"FoodState", 360, 7, 79, 0.6, now())`,
      id,
      name,
      state,
    );
    catalogIds.push(id);
    return { id, name };
  };

  const postYield = (u: User, body: unknown) =>
    request(http())
      .post('/food-yields')
      .set(auth(u))
      .send(body as object);
  const createYield = async (u: User, raw: Ref, cooked: Ref, factor = 2.5) => {
    const res = await postYield(u, {
      rawFoodId: raw.id,
      cookedFoodId: cooked.id,
      factor,
    });
    expect(res.status).toBe(201);
    return res.body as Yield;
  };
  const pair = async (u: User) => ({
    raw: await food(u, 'RAW'),
    cooked: await food(u, 'COOKED'),
  });
  const countYields = (userId: string) =>
    prisma.$queryRawUnsafe<{ n: number }[]>(
      'SELECT count(*)::int AS n FROM food_yields WHERE user_id = $1',
      userId,
    );
  const foodRow = (id: string) =>
    prisma.$queryRawUnsafe<{ state: string }[]>(
      'SELECT state::text AS state FROM foods WHERE id = $1',
      id,
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

  it('C1: cria com cru do catálogo e pronto próprio; corpo sem userId', async () => {
    const u = await signUp();
    const raw = await insertCatalog('RAW');
    const cooked = await food(u, 'COOKED');
    const res = await postYield(u, {
      rawFoodId: raw.id,
      cookedFoodId: cooked.id,
      factor: 2.5,
    });
    expect(res.status).toBe(201);
    const body = res.body as Yield & Record<string, unknown>;
    expect(Object.keys(body).sort()).toEqual(
      [
        'cookedFood',
        'createdAt',
        'factor',
        'id',
        'rawFood',
        'updatedAt',
      ].sort(),
    );
    expect(body.factor).toBe('2.5');
    expect(body.rawFood).toEqual({ id: raw.id, name: raw.name });
    expect(body.cookedFood).toEqual({ id: cooked.id, name: cooked.name });
    expect(body).not.toHaveProperty('userId');
  });

  it('C2: cru que é COOKED ou pronto que é RAW dá 400 e nada é criado', async () => {
    const u = await signUp();
    const raw = await food(u, 'RAW');
    const cooked = await food(u, 'COOKED');
    const r1 = await postYield(u, {
      rawFoodId: cooked.id,
      cookedFoodId: cooked.id,
      factor: 2,
    });
    expect(r1.status).toBe(400);
    const r2 = await postYield(u, {
      rawFoodId: raw.id,
      cookedFoodId: raw.id,
      factor: 2,
    });
    expect(r2.status).toBe(400);
    expect((await countYields(u.id))[0].n).toBe(0);
  });

  it('C3: alimento alheio ou inexistente, nas duas posições, dá 404 e nada é criado', async () => {
    const u = await signUp();
    const other = await signUp();
    const { raw, cooked } = await pair(u);
    const otherRaw = await food(other, 'RAW');
    const otherCooked = await food(other, 'COOKED');
    const cases = [
      { rawFoodId: otherRaw.id, cookedFoodId: cooked.id },
      { rawFoodId: raw.id, cookedFoodId: otherCooked.id },
      { rawFoodId: randomUUID(), cookedFoodId: cooked.id },
      { rawFoodId: raw.id, cookedFoodId: randomUUID() },
    ];
    for (const c of cases) {
      const res = await postYield(u, { ...c, factor: 2 });
      expect(res.status).toBe(404);
      expect((res.body as { message: string }).message).toBe(FOOD_NOT_FOUND);
    }
    expect((await countYields(u.id))[0].n).toBe(0);
  });

  describe('C4: validação do fator', () => {
    const invalid: [string, Record<string, unknown>][] = [
      ['ausente', {}],
      ['zero', { factor: 0 }],
      ['negativo', { factor: -1 }],
      ['3 casas', { factor: 2.555 }],
      ['texto', { factor: 'abc' }],
      ['10000', { factor: 10000 }],
    ];
    for (const [name, extra] of invalid) {
      it(`400 e nada gravado: ${name}`, async () => {
        const u = await signUp();
        const { raw, cooked } = await pair(u);
        const res = await postYield(u, {
          rawFoodId: raw.id,
          cookedFoodId: cooked.id,
          ...extra,
        });
        expect(res.status).toBe(400);
        expect((await countYields(u.id))[0].n).toBe(0);
      });
    }
    for (const [factor, text] of [
      [0.01, '0.01'],
      [9999.99, '9999.99'],
    ] as const) {
      it(`201 na borda: ${factor}`, async () => {
        const u = await signUp();
        const { raw, cooked } = await pair(u);
        const y = await createYield(u, raw, cooked, factor);
        expect(y.factor).toBe(text);
      });
    }
  });

  it('C5: par repetido 409; outro usuário e outro pronto 201; duplicata ao mesmo tempo 201 + 409', async () => {
    const u = await signUp();
    const other = await signUp();
    const raw = await insertCatalog('RAW');
    const cooked = await insertCatalog('COOKED');
    await createYield(u, raw, cooked);
    const dup = await postYield(u, {
      rawFoodId: raw.id,
      cookedFoodId: cooked.id,
      factor: 3,
    });
    expect(dup.status).toBe(409);
    expect((dup.body as { message: string }).message).toBe(DUPLICATE);
    await createYield(other, raw, cooked);
    await createYield(u, raw, await food(u, 'COOKED'));

    const { raw: r2, cooked: c2 } = await pair(u);
    const body = { rawFoodId: r2.id, cookedFoodId: c2.id, factor: 2 };
    const results = await Promise.all([postYield(u, body), postYield(u, body)]);
    expect(results.map((r) => r.status).sort()).toEqual([201, 409]);
  });

  it('C6: lista só os próprios, ordenados por cru, pronto e id; busca por id', async () => {
    const u = await signUp();
    const other = await signUp();
    const tag = randomUUID();
    const rawA = await food(u, 'RAW', `A ${tag}`);
    const rawB = await food(u, 'RAW', `B ${tag}`);
    const cookedA = await food(u, 'COOKED', `A ${tag}`);
    const cookedB = await food(u, 'COOKED', `B ${tag}`);
    const y3 = await createYield(u, rawB, cookedA);
    const y2 = await createYield(u, rawA, cookedB);
    const y1 = await createYield(u, rawA, cookedA);
    const o = await pair(other);
    await createYield(other, o.raw, o.cooked);

    const res = await request(http()).get('/food-yields').set(auth(u));
    expect(res.status).toBe(200);
    const ids = (res.body as Yield[]).map((y) => y.id);
    expect(ids).toEqual([y1.id, y2.id, y3.id]);

    const one = await request(http()).get(`/food-yields/${y2.id}`).set(auth(u));
    expect(one.status).toBe(200);
    expect(one.body).toEqual(y2);
  });

  it('C7: PATCH troca o fator; outros campos e fator inválido dão 400', async () => {
    const u = await signUp();
    const { raw, cooked } = await pair(u);
    const y = await createYield(u, raw, cooked, 2.5);
    const ok = await request(http())
      .patch(`/food-yields/${y.id}`)
      .set(auth(u))
      .send({ factor: 0.7 });
    expect(ok.status).toBe(200);
    expect((ok.body as Yield).factor).toBe('0.7');

    const other = await food(u, 'RAW');
    for (const body of [
      { rawFoodId: other.id },
      { cookedFoodId: other.id },
      { userId: u.id },
      { factor: 0 },
      { factor: 2.555 },
      { factor: 10000 },
    ]) {
      const res = await request(http())
        .patch(`/food-yields/${y.id}`)
        .set(auth(u))
        .send(body);
      expect(res.status).toBe(400);
    }
    const after = await request(http())
      .get(`/food-yields/${y.id}`)
      .set(auth(u));
    expect((after.body as Yield).factor).toBe('0.7');
    expect((after.body as Yield).rawFood.id).toBe(raw.id);
  });

  it('C8: DELETE dá 204 e some da lista', async () => {
    const u = await signUp();
    const { raw, cooked } = await pair(u);
    const y = await createYield(u, raw, cooked);
    await request(http())
      .delete(`/food-yields/${y.id}`)
      .set(auth(u))
      .expect(204);
    const res = await request(http()).get('/food-yields').set(auth(u));
    expect((res.body as Yield[]).map((x) => x.id)).not.toContain(y.id);
  });

  it('C9: rendimento alheio ou inexistente dá 404 nos três verbos; id inválido 400', async () => {
    const u = await signUp();
    const other = await signUp();
    const { raw, cooked } = await pair(other);
    const y = await createYield(other, raw, cooked, 2.5);
    for (const id of [y.id, randomUUID()]) {
      const g = await request(http()).get(`/food-yields/${id}`).set(auth(u));
      const p = await request(http())
        .patch(`/food-yields/${id}`)
        .set(auth(u))
        .send({ factor: 9 });
      const d = await request(http()).delete(`/food-yields/${id}`).set(auth(u));
      for (const res of [g, p, d]) {
        expect(res.status).toBe(404);
        expect((res.body as { message: string }).message).toBe(YIELD_NOT_FOUND);
      }
    }
    const still = await request(http())
      .get(`/food-yields/${y.id}`)
      .set(auth(other));
    expect((still.body as Yield).factor).toBe('2.5');
    // Cada pedido é criado só na hora do await: o supertest fecha a porta
    // do servidor quando o primeiro termina.
    for (const req of [
      () => request(http()).get('/food-yields/nao-e-uuid').set(auth(u)),
      () =>
        request(http())
          .patch('/food-yields/nao-e-uuid')
          .set(auth(u))
          .send({ factor: 2 }),
      () => request(http()).delete('/food-yields/nao-e-uuid').set(auth(u)),
    ]) {
      expect((await req()).status).toBe(400);
    }
  });

  it('C10: apagar alimento em rendimento (cru ou pronto) dá 409; sem rendimento, 204', async () => {
    const u = await signUp();
    const { raw, cooked } = await pair(u);
    const y = await createYield(u, raw, cooked);
    for (const f of [raw, cooked]) {
      const res = await request(http()).delete(`/foods/${f.id}`).set(auth(u));
      expect(res.status).toBe(409);
      expect((res.body as { message: string }).message).toBe(IN_USE);
      expect(await foodRow(f.id)).toHaveLength(1);
    }
    await request(http())
      .delete(`/food-yields/${y.id}`)
      .set(auth(u))
      .expect(204);
    await request(http()).delete(`/foods/${raw.id}`).set(auth(u)).expect(204);
    await request(http())
      .delete(`/foods/${cooked.id}`)
      .set(auth(u))
      .expect(204);
  });

  it('C11: PATCH que muda state de alimento em rendimento dá 409; mesmo state ou outros campos, 200', async () => {
    const u = await signUp();
    const { raw, cooked } = await pair(u);
    await createYield(u, raw, cooked);
    const change = await request(http())
      .patch(`/foods/${cooked.id}`)
      .set(auth(u))
      .send({ state: 'RAW', kcal: 200 });
    expect(change.status).toBe(409);
    expect((change.body as { message: string }).message).toBe(IN_USE);
    const row = await prisma.$queryRawUnsafe<{ state: string; kcal: string }[]>(
      'SELECT state::text AS state, kcal::text AS kcal FROM foods WHERE id = $1',
      cooked.id,
    );
    expect(row[0]).toEqual({ state: 'COOKED', kcal: '130.0' });

    const same = await request(http())
      .patch(`/foods/${cooked.id}`)
      .set(auth(u))
      .send({ state: 'COOKED' });
    expect(same.status).toBe(200);
    const other = await request(http())
      .patch(`/foods/${raw.id}`)
      .set(auth(u))
      .send({ kcal: 350 });
    expect(other.status).toBe(200);
  });

  describe('C12: concorrência', () => {
    const ROUNDS = 20;

    it('POST do rendimento x DELETE do alimento: estado válido, sem 500', async () => {
      const u = await signUp();
      for (let i = 0; i < ROUNDS; i++) {
        const { raw, cooked } = await pair(u);
        const [y, d] = await Promise.all([
          postYield(u, {
            rawFoodId: raw.id,
            cookedFoodId: cooked.id,
            factor: 2,
          }),
          request(http()).delete(`/foods/${raw.id}`).set(auth(u)),
        ]);
        const exists = (await foodRow(raw.id)).length === 1;
        if (y.status === 201) {
          expect(d.status).toBe(409);
          expect(exists).toBe(true);
        } else {
          expect([y.status, d.status]).toEqual([404, 204]);
          expect(exists).toBe(false);
        }
      }
      const n = await prisma.$queryRawUnsafe<{ n: number }[]>(
        `SELECT count(*)::int AS n FROM food_yields y
         LEFT JOIN foods r ON r.id = y.raw_food_id
         WHERE y.user_id = $1 AND (r.id IS NULL OR r.state <> 'RAW')`,
        u.id,
      );
      expect(n[0].n).toBe(0);
    });

    it('POST do rendimento x PATCH de state: estado válido, sem 500', async () => {
      const u = await signUp();
      for (let i = 0; i < ROUNDS; i++) {
        const { raw, cooked } = await pair(u);
        const [y, p] = await Promise.all([
          postYield(u, {
            rawFoodId: raw.id,
            cookedFoodId: cooked.id,
            factor: 2,
          }),
          request(http())
            .patch(`/foods/${cooked.id}`)
            .set(auth(u))
            .send({ state: 'RAW' }),
        ]);
        const state = (await foodRow(cooked.id))[0].state;
        if (y.status === 201) {
          expect(p.status).toBe(409);
          expect(state).toBe('COOKED');
        } else {
          expect([y.status, p.status]).toEqual([400, 200]);
          expect(state).toBe('RAW');
        }
      }
      const n = await prisma.$queryRawUnsafe<{ n: number }[]>(
        `SELECT count(*)::int AS n FROM food_yields y
         JOIN foods c ON c.id = y.cooked_food_id
         WHERE y.user_id = $1 AND c.state <> 'COOKED'`,
        u.id,
      );
      expect(n[0].n).toBe(0);
    });

    it('dois POST com ids invertidos: um 201, outro 400, sem 500 nem deadlock', async () => {
      const u = await signUp();
      for (let i = 0; i < ROUNDS; i++) {
        const { raw, cooked } = await pair(u);
        const results = await Promise.all([
          postYield(u, {
            rawFoodId: raw.id,
            cookedFoodId: cooked.id,
            factor: 2,
          }),
          postYield(u, {
            rawFoodId: cooked.id,
            cookedFoodId: raw.id,
            factor: 2,
          }),
        ]);
        expect(results.map((r) => r.status).sort()).toEqual([201, 400]);
      }
    });
  });
});
