// Tarefa 10a: alimentos e /foods.
// O catálogo é inserido por SQL (não há rota que crie alimento do catálogo).
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { randomUUID } from 'crypto';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import type { Server } from 'http';

type User = { id: string; token: string };
type Food = {
  id: string;
  name: string;
  state: string;
  kcal: string;
  proteinG: string;
  carbsG: string;
  fatG: string;
  fiberG: string | null;
  tags: string[];
  createdAt: string;
  updatedAt: string;
};

const NOT_FOUND = 'Alimento não encontrado';
const CATALOG_LOCKED = 'Alimento do catálogo não pode ser alterado';

const base = () => ({
  name: `Arroz ${randomUUID()}`,
  state: 'COOKED',
  kcal: 128,
  proteinG: 2.5,
  carbsG: 28.1,
  fatG: 0.2,
});

describe('Alimentos (tarefa 10a)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const userIds: string[] = [];
  const catalogIds: string[] = [];
  const uid = randomUUID().slice(0, 8);

  const http = () => app.getHttpServer() as Server;
  const auth = (u: User) => ({ Authorization: `Bearer ${u.token}` });

  const signUp = async (): Promise<User> => {
    const email = `foods10-${randomUUID()}@example.com`;
    const reg = await request(http())
      .post('/auth/register')
      .send({ name: 'Alimentos', email, password: 'password123' })
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
      .post('/foods')
      .set(auth(u))
      .send(body as object);
  const create = async (u: User, extra: Record<string, unknown> = {}) => {
    const res = await post(u, { ...base(), ...extra });
    expect(res.status).toBe(201);
    return res.body as Food;
  };
  const list = async (u: User, query = '') => {
    const res = await request(http()).get(`/foods${query}`).set(auth(u));
    return res;
  };
  const getOne = (u: User, id: string) =>
    request(http()).get(`/foods/${id}`).set(auth(u));
  const patch = (u: User, id: string, body: unknown) =>
    request(http())
      .patch(`/foods/${id}`)
      .set(auth(u))
      .send(body as object);
  const del = (u: User, id: string) =>
    request(http()).delete(`/foods/${id}`).set(auth(u));

  const insertCatalog = async (name: string, tags: string[] = []) => {
    const id = randomUUID();
    await prisma.$executeRawUnsafe(
      `INSERT INTO foods (id, name, state, kcal, protein_g, carbs_g, fat_g, tags, updated_at)
       VALUES ($1, $2, 'COOKED'::"FoodState", 60, 1, 15, 0.2, $3::"FoodTag"[], now())`,
      id,
      name,
      tags,
    );
    catalogIds.push(id);
    return id;
  };

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

  it('C1: cria alimento próprio; números como texto; fiberG e tags com padrão', async () => {
    const u = await signUp();
    const body = base();
    const res = await post(u, body);
    expect(res.status).toBe(201);
    const food = res.body as Food;
    expect(Object.keys(food).sort()).toEqual(
      [
        'id',
        'name',
        'state',
        'kcal',
        'proteinG',
        'carbsG',
        'fatG',
        'fiberG',
        'tags',
        'createdAt',
        'updatedAt',
      ].sort(),
    );
    expect(food).toMatchObject({
      name: body.name,
      state: 'COOKED',
      kcal: '128',
      proteinG: '2.5',
      carbsG: '28.1',
      fatG: '0.2',
      fiberG: null,
      tags: [],
    });

    const full = await create(u, {
      fiberG: 1.6,
      tags: ['VEGAN', 'GLUTEN_FREE'],
    });
    expect(full.fiberG).toBe('1.6');
    expect([...full.tags].sort()).toEqual(['GLUTEN_FREE', 'VEGAN']);
  });

  describe('C2: validação no POST', () => {
    let u: User;
    beforeAll(async () => {
      u = await signUp();
    });

    const invalid: Array<[string, () => Record<string, unknown>]> = [
      ['name vazio', () => ({ ...base(), name: '' })],
      ['name com 101 caracteres', () => ({ ...base(), name: 'a'.repeat(101) })],
      ['name com byte nulo', () => ({ ...base(), name: `Arroz\u0000${uid}` })],
      ['state fora da lista', () => ({ ...base(), state: 'FRIED' })],
      [
        'state ausente',
        () => {
          const b: Record<string, unknown> = base();
          delete b.state;
          return b;
        },
      ],
      ['kcal 900.1', () => ({ ...base(), kcal: 900.1 })],
      [
        'proteinG 100.1',
        () => ({ ...base(), proteinG: 100.1, carbsG: 0, fatG: 0 }),
      ],
      [
        'soma 100.1',
        () => ({ ...base(), proteinG: 50, carbsG: 50, fatG: 0, fiberG: 0.1 }),
      ],
      ['tag fora da lista', () => ({ ...base(), tags: ['KETO'] })],
      ['tag repetida', () => ({ ...base(), tags: ['VEGAN', 'VEGAN'] })],
      ['tags que não é lista', () => ({ ...base(), tags: 'VEGAN' })],
      [
        'campo desconhecido userId',
        () => ({ ...base(), userId: randomUUID() }),
      ],
    ];
    for (const field of ['kcal', 'proteinG', 'carbsG', 'fatG']) {
      invalid.push(
        [
          `${field} ausente`,
          () => {
            const b: Record<string, unknown> = base();
            delete b[field];
            return b;
          },
        ],
        [`${field} null`, () => ({ ...base(), [field]: null })],
        [`${field} negativo`, () => ({ ...base(), [field]: -1 })],
        [`${field} texto`, () => ({ ...base(), [field]: '10' })],
        [`${field} com 2 casas`, () => ({ ...base(), [field]: 10.25 })],
      );
    }

    for (const [name, body] of invalid) {
      it(`400 e nada gravado: ${name}`, async () => {
        const before = ((await list(u)).body as Food[]).length;
        const res = await post(u, body());
        expect(res.status).toBe(400);
        expect(((await list(u)).body as Food[]).length).toBe(before);
      });
    }

    const accepted: Array<[string, () => Record<string, unknown>]> = [
      ['kcal 0', () => ({ ...base(), kcal: 0 })],
      ['kcal 900', () => ({ ...base(), kcal: 900 })],
      [
        'um macro 100 e os outros 0',
        () => ({ ...base(), proteinG: 100, carbsG: 0, fatG: 0 }),
      ],
      [
        'soma exatamente 100 com casas decimais',
        () => ({
          ...base(),
          proteinG: 0,
          carbsG: 3.9,
          fatG: 64.9,
          fiberG: 31.2,
        }),
      ],
      ['valor 12.3', () => ({ ...base(), carbsG: 12.3 })],
      ['name com 100 caracteres', () => ({ ...base(), name: 'a'.repeat(100) })],
      [
        'as 4 tags',
        () => ({
          ...base(),
          tags: ['GLUTEN_FREE', 'LACTOSE_FREE', 'VEGAN', 'VEGETARIAN'],
        }),
      ],
    ];
    for (const [name, body] of accepted) {
      it(`201 na borda: ${name}`, async () => {
        const res = await post(u, body());
        expect(res.status).toBe(201);
      });
    }
  });

  it('C3: lista catálogo + próprios, sem os de outro usuário, ordenada por nome', async () => {
    const a = await signUp();
    const b = await signUp();
    const kiwi = await create(a, { name: `Kiwi ${uid}` });
    const laranja = await create(a, { name: `Laranja ${uid}` });
    const manga = await insertCatalog(`Manga ${uid}`);
    const uva = await create(b, { name: `Uva ${uid}` });

    const res = await list(a);
    expect(res.status).toBe(200);
    const ids = (res.body as Food[]).map((f) => f.id);
    expect(ids).not.toContain(uva.id);
    const mine = ids.filter((id) => [kiwi.id, laranja.id, manga].includes(id));
    expect(mine).toEqual([kiwi.id, laranja.id, manga]);
  });

  describe('C4: filtros', () => {
    let u: User;
    let branco: Food;
    let integral: Food;
    let feijao: Food;
    const ids = (r: request.Response) => (r.body as Food[]).map((f) => f.id);

    beforeAll(async () => {
      u = await signUp();
      branco = await create(u, {
        name: `Arroz branco ${uid}`,
        state: 'COOKED',
        tags: ['VEGAN', 'GLUTEN_FREE'],
      });
      integral = await create(u, {
        name: `ARROZ integral ${uid}`,
        state: 'RAW',
        tags: ['VEGAN'],
      });
      feijao = await create(u, { name: `Feijão ${uid}`, state: 'COOKED' });
    });

    it('search=arroz acha os dois arroz, sem diferenciar maiúsculas, e não o feijão', async () => {
      const res = await list(u, '?search=arroz');
      expect(res.status).toBe(200);
      expect(ids(res)).toEqual(
        expect.arrayContaining([branco.id, integral.id]),
      );
      expect(ids(res)).not.toContain(feijao.id);
    });

    it('state=COOKED só traz prontos', async () => {
      const res = await list(u, '?state=COOKED');
      expect(res.status).toBe(200);
      expect((res.body as Food[]).every((f) => f.state === 'COOKED')).toBe(
        true,
      );
      expect(ids(res)).toEqual(expect.arrayContaining([branco.id, feijao.id]));
      expect(ids(res)).not.toContain(integral.id);
    });

    it('tag=VEGAN sozinho só traz os que têm VEGAN', async () => {
      const res = await list(u, '?tag=VEGAN');
      expect(res.status).toBe(200);
      expect((res.body as Food[]).every((f) => f.tags.includes('VEGAN'))).toBe(
        true,
      );
      expect(ids(res)).toEqual(
        expect.arrayContaining([branco.id, integral.id]),
      );
      expect(ids(res)).not.toContain(feijao.id);
    });

    it('tag=VEGAN&tag=GLUTEN_FREE só traz os que têm as duas', async () => {
      const res = await list(u, '?tag=VEGAN&tag=GLUTEN_FREE');
      expect(res.status).toBe(200);
      expect(
        (res.body as Food[]).every(
          (f) => f.tags.includes('VEGAN') && f.tags.includes('GLUTEN_FREE'),
        ),
      ).toBe(true);
      expect(ids(res)).toContain(branco.id);
      expect(ids(res)).not.toContain(integral.id);
      expect(ids(res)).not.toContain(feijao.id);
    });

    it('search trata % e _ como texto, não como curinga', async () => {
      const pct = await create(u, { name: `Leite 50% ${uid}` });
      const under = await create(u, { name: `Pao_de_queijo ${uid}` });
      const q = (s: string) => list(u, `?search=${encodeURIComponent(s)}`);

      expect(ids(await q('ar%z'))).not.toContain(branco.id);
      expect(ids(await q('ar_oz'))).not.toContain(branco.id);

      const onlyPct = ids(await q('%'));
      expect(onlyPct).toContain(pct.id);
      expect(onlyPct).not.toContain(branco.id);

      const onlyUnder = ids(await q('_'));
      expect(onlyUnder).toContain(under.id);
      expect(onlyUnder).not.toContain(branco.id);

      expect(ids(await q('50%'))).toContain(pct.id);
      expect(ids(await q('o_de_q'))).toContain(under.id);
    });

    it('search acha nome com contrabarra pelo próprio texto', async () => {
      const slash = await create(u, { name: `Arroz\\feijao ${uid}` });
      const q = (s: string) => list(u, `?search=${encodeURIComponent(s)}`);

      expect(ids(await q('\\'))).toContain(slash.id);
      expect(ids(await q('z\\f'))).toContain(slash.id);
      expect(ids(await q('\\'))).not.toContain(branco.id);
    });

    const bad: Array<[string, string]> = [
      ['state fora da lista', '?state=FRIED'],
      ['tag fora da lista', '?tag=KETO'],
      ['search com byte nulo', '?search=arr%00oz'],
      ['search com 101 caracteres', `?search=${'a'.repeat(101)}`],
      ['search repetido', '?search=a&search=b'],
      ['state repetido', '?state=RAW&state=COOKED'],
    ];
    for (const [name, query] of bad) {
      it(`400: ${name}`, async () => {
        expect((await list(u, query)).status).toBe(400);
      });
    }
  });

  it('C5: busca por id: catálogo e próprio 200; alheio e inexistente 404; id inválido 400', async () => {
    const a = await signUp();
    const b = await signUp();
    const own = await create(a);
    const catalog = await insertCatalog(`Pera ${uid}`, ['VEGAN']);
    const other = await create(b);

    const ownRes = await getOne(a, own.id);
    expect(ownRes.status).toBe(200);
    expect(ownRes.body).toEqual(own);

    const catRes = await getOne(a, catalog);
    expect(catRes.status).toBe(200);
    expect((catRes.body as Food).tags).toEqual(['VEGAN']);

    for (const id of [other.id, randomUUID()]) {
      const res = await getOne(a, id);
      expect(res.status).toBe(404);
      expect((res.body as { message: string }).message).toBe(NOT_FOUND);
    }
    expect((await getOne(a, 'nao-e-uuid')).status).toBe(400);
  });

  it('C6: PATCH parcial, null e soma com os valores gravados', async () => {
    const u = await signUp();
    const food = await create(u, {
      fiberG: 1.6,
      tags: ['VEGAN'],
    });

    const kcal = await patch(u, food.id, { kcal: 130 });
    expect(kcal.status).toBe(200);
    expect(kcal.body).toMatchObject({
      ...food,
      kcal: '130',
      updatedAt: expect.any(String) as string,
    });

    const noFiber = await patch(u, food.id, { fiberG: null });
    expect(noFiber.status).toBe(200);
    expect((noFiber.body as Food).fiberG).toBeNull();

    const noTags = await patch(u, food.id, { tags: [] });
    expect(noTags.status).toBe(200);
    expect((noTags.body as Food).tags).toEqual([]);

    const saved = (await getOne(u, food.id)).body as Food;
    for (const body of [
      { name: null },
      { state: null },
      { tags: null },
      { kcal: null },
    ]) {
      const res = await patch(u, food.id, body);
      expect(res.status).toBe(400);
      expect((await getOne(u, food.id)).body).toEqual(saved);
    }

    const p60 = await create(u, { proteinG: 60, carbsG: 0, fatG: 0 });
    const over = await patch(u, p60.id, { carbsG: 41 });
    expect(over.status).toBe(400);
    expect((await getOne(u, p60.id)).body).toEqual(p60);

    const exact = await create(u, {
      proteinG: 0,
      carbsG: 0,
      fatG: 64.9,
      fiberG: 31.2,
    });
    const ok = await patch(u, exact.id, { carbsG: 3.9 });
    expect(ok.status).toBe(200);
    expect((ok.body as Food).carbsG).toBe('3.9');
  });

  it('C7: catálogo dá 403 e não muda; alheio dá 404 e não muda', async () => {
    const a = await signUp();
    const b = await signUp();
    const catalog = await insertCatalog(`Caqui ${uid}`);
    const before = (await getOne(a, catalog)).body as Food;

    for (const res of [
      await patch(a, catalog, { kcal: 1 }),
      await del(a, catalog),
    ]) {
      expect(res.status).toBe(403);
      expect((res.body as { message: string }).message).toBe(CATALOG_LOCKED);
    }
    expect((await getOne(a, catalog)).body).toEqual(before);

    const other = await create(b);
    for (const res of [
      await patch(a, other.id, { kcal: 1 }),
      await del(a, other.id),
    ]) {
      expect(res.status).toBe(404);
      expect((res.body as { message: string }).message).toBe(NOT_FOUND);
    }
    expect((await getOne(b, other.id)).body).toEqual(other);
  });

  it('C8: apaga o próprio: 204, depois 404 e some da lista', async () => {
    const u = await signUp();
    const food = await create(u);
    const res = await del(u, food.id);
    expect(res.status).toBe(204);
    expect((await getOne(u, food.id)).status).toBe(404);
    expect(((await list(u)).body as Food[]).map((f) => f.id)).not.toContain(
      food.id,
    );
  });

  it('C9: sem token, todas as rotas dão 401', async () => {
    const id = randomUUID();
    await request(http()).get('/foods').expect(401);
    await request(http()).get(`/foods/${id}`).expect(401);
    await request(http()).post('/foods').send(base()).expect(401);
    await request(http()).patch(`/foods/${id}`).send({ kcal: 1 }).expect(401);
    await request(http()).delete(`/foods/${id}`).expect(401);
  });
});
