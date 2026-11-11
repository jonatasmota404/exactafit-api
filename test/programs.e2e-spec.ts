// Tarefa 7a (docs/plans/2026-11-11-programas-crud.md): CRUD de /programs, ativação e limites do ciclo.
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { randomUUID } from 'crypto';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import type { Server } from 'http';

type DayBody = { week: number; day: number; workoutId: string; order: number };
type DayResponse = DayBody & { workout: { id: string; name: string } };
type ProgramResponse = {
  id: string;
  name: string;
  cycleType: string;
  cycleDays: number;
  weeks: number;
  startDate: string;
  active: boolean;
  days: DayResponse[];
};

type User = { id: string; token: string; workoutA: string; workoutB: string };

describe('Programas (/programs)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const userIds: string[] = [];

  const http = () => app.getHttpServer() as Server;

  const signUp = async (): Promise<User> => {
    const email = `prog7-${randomUUID()}@example.com`;
    const reg = await request(http())
      .post('/auth/register')
      .send({ name: 'Programa', email, password: 'password123' })
      .expect(201);
    const id = (reg.body as { id: string }).id;
    userIds.push(id);
    const login = await request(http())
      .post('/auth/login')
      .send({ email, password: 'password123' })
      .expect(201);
    const token = (login.body as { accessToken: string }).accessToken;

    const ex = await request(http())
      .post('/exercises')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Supino', muscleGroup: 'chest' })
      .expect(201);
    const exerciseId = (ex.body as { id: string }).id;

    const workout = async (name: string) => {
      const res = await request(http())
        .post('/workouts')
        .set('Authorization', `Bearer ${token}`)
        .send({
          name,
          items: [{ exerciseId, order: 1, targetSets: 3, targetReps: 10 }],
        })
        .expect(201);
      return (res.body as { id: string }).id;
    };

    return {
      id,
      token,
      workoutA: await workout('Treino A'),
      workoutB: await workout('Treino B'),
    };
  };

  const auth = (u: User) => ({ Authorization: `Bearer ${u.token}` });

  const create = (u: User, body: Record<string, unknown>) =>
    request(http()).post('/programs').set(auth(u)).send(body);

  const weekly = (u: User, extra: Record<string, unknown> = {}) => ({
    name: 'Semanal',
    cycleType: 'WEEKLY',
    startDate: '2026-11-16',
    days: [{ week: 1, day: 1, workoutId: u.workoutA, order: 1 }],
    ...extra,
  });

  const createOk = async (u: User, body: Record<string, unknown>) => {
    const res = await create(u, body);
    expect(res.status).toBe(201);
    return res.body as ProgramResponse;
  };

  const get = async (u: User, id: string) => {
    const res = await request(http()).get(`/programs/${id}`).set(auth(u));
    expect(res.status).toBe(200);
    return res.body as ProgramResponse;
  };

  const activeIds = async (userId: string) => {
    const rows = await prisma.$queryRaw<{ id: string }[]>`
      SELECT id FROM programs WHERE user_id = ${userId} AND active ORDER BY id`;
    return rows.map((r) => r.id);
  };

  const countPrograms = async (userId: string) => {
    const rows = await prisma.$queryRaw<{ n: bigint }[]>`
      SELECT count(*) AS n FROM programs WHERE user_id = ${userId}`;
    return Number(rows[0].n);
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
    // FKs Restrict (C3): programas (dias em cascata) → treinos (itens em cascata) → exercícios → usuários.
    for (const id of userIds) {
      await prisma.$executeRaw`DELETE FROM programs WHERE user_id = ${id}`;
      await prisma.$executeRaw`DELETE FROM workouts WHERE user_id = ${id}`;
      await prisma.$executeRaw`DELETE FROM exercises WHERE user_id = ${id}`;
    }
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    await prisma.$disconnect();
    await app.close();
  });

  it('C1: rotas sem token dão 401', async () => {
    const id = randomUUID();
    const calls = [
      request(http()).post('/programs').send({}),
      request(http()).get('/programs'),
      request(http()).get(`/programs/${id}`),
      request(http()).patch(`/programs/${id}`).send({}),
      request(http()).delete(`/programs/${id}`),
      request(http()).post(`/programs/${id}/activate`),
      request(http()).post(`/programs/${id}/deactivate`),
    ];
    for (const call of calls) {
      expect((await call).status).toBe(401);
    }
  });

  it('C2: cria semanal A-B', async () => {
    const u = await signUp();
    const p = await createOk(
      u,
      weekly(u, {
        name: 'PPL',
        weeks: 2,
        days: [
          { week: 2, day: 1, workoutId: u.workoutB, order: 1 },
          { week: 1, day: 5, workoutId: u.workoutB, order: 2 },
          { week: 1, day: 5, workoutId: u.workoutA, order: 1 },
          { week: 1, day: 1, workoutId: u.workoutA, order: 1 },
        ],
      }),
    );

    expect(p).toMatchObject({
      name: 'PPL',
      cycleType: 'WEEKLY',
      cycleDays: 7,
      weeks: 2,
      startDate: '2026-11-16',
      active: false,
    });
    expect(
      p.days.map((d) => [d.week, d.day, d.order, d.workoutId, d.workout]),
    ).toEqual([
      [1, 1, 1, u.workoutA, { id: u.workoutA, name: 'Treino A' }],
      [1, 5, 1, u.workoutA, { id: u.workoutA, name: 'Treino A' }],
      [1, 5, 2, u.workoutB, { id: u.workoutB, name: 'Treino B' }],
      [2, 1, 1, u.workoutB, { id: u.workoutB, name: 'Treino B' }],
    ]);

    const again = await get(u, p.id);
    expect(again.startDate).toBe('2026-11-16');
    expect(again.days).toHaveLength(4);
  });

  it('C3: cria rotativo de 5 dias', async () => {
    const u = await signUp();
    const p = await createOk(u, {
      name: 'Rotativo',
      cycleType: 'ROTATING',
      cycleDays: 5,
      startDate: '2026-11-16',
      days: [
        { week: 1, day: 1, workoutId: u.workoutA, order: 1 },
        { week: 1, day: 2, workoutId: u.workoutB, order: 1 },
        { week: 1, day: 4, workoutId: u.workoutA, order: 1 },
      ],
    });
    expect(p).toMatchObject({ cycleType: 'ROTATING', cycleDays: 5, weeks: 1 });
    expect(p.days.map((d) => d.day)).toEqual([1, 2, 4]);
  });

  it('C3: rotativo sem cycleDays dá 400', async () => {
    const u = await signUp();
    const res = await create(u, {
      name: 'Rotativo',
      cycleType: 'ROTATING',
      startDate: '2026-11-16',
    });
    expect(res.status).toBe(400);
    expect(await countPrograms(u.id)).toBe(0);
  });

  describe('C4: limites do ciclo', () => {
    let u: User;
    beforeAll(async () => {
      u = await signUp();
    });

    const rotating = (extra: Record<string, unknown>) => ({
      name: 'Rotativo',
      cycleType: 'ROTATING',
      cycleDays: 5,
      startDate: '2026-11-16',
      ...extra,
    });

    const cases: [string, (u: User) => Record<string, unknown>][] = [
      ['semanal com weeks 0', (u) => weekly(u, { weeks: 0 })],
      ['semanal com weeks 5', (u) => weekly(u, { weeks: 5 })],
      ['semanal com cycleDays 6', (u) => weekly(u, { cycleDays: 6 })],
      ['rotativo com cycleDays 1', () => rotating({ cycleDays: 1 })],
      ['rotativo com cycleDays 15', () => rotating({ cycleDays: 15 })],
      ['rotativo com weeks 2', () => rotating({ weeks: 2 })],
      [
        'dia com week 0',
        (u) =>
          weekly(u, {
            days: [{ week: 0, day: 1, workoutId: u.workoutA, order: 1 }],
          }),
      ],
      [
        'dia com week acima de weeks',
        (u) =>
          weekly(u, {
            weeks: 2,
            days: [{ week: 3, day: 1, workoutId: u.workoutA, order: 1 }],
          }),
      ],
      [
        'semanal com day 8',
        (u) =>
          weekly(u, {
            days: [{ week: 1, day: 8, workoutId: u.workoutA, order: 1 }],
          }),
      ],
      [
        'semanal com day 0',
        (u) =>
          weekly(u, {
            days: [{ week: 1, day: 0, workoutId: u.workoutA, order: 1 }],
          }),
      ],
      [
        'rotativo de 5 com day 6',
        (u) =>
          rotating({
            days: [{ week: 1, day: 6, workoutId: u.workoutA, order: 1 }],
          }),
      ],
      [
        'order negativo',
        (u) =>
          weekly(u, {
            days: [{ week: 1, day: 1, workoutId: u.workoutA, order: -1 }],
          }),
      ],
      [
        'order repetido no mesmo dia',
        (u) =>
          weekly(u, {
            days: [
              { week: 1, day: 1, workoutId: u.workoutA, order: 1 },
              { week: 1, day: 1, workoutId: u.workoutB, order: 1 },
            ],
          }),
      ],
    ];

    it.each(cases)('%s dá 400', async (_name, body) => {
      const res = await create(u, body(u));
      expect(res.status).toBe(400);
      expect(await countPrograms(u.id)).toBe(0);
    });

    it('order igual em dias diferentes é aceito', async () => {
      await createOk(
        u,
        weekly(u, {
          days: [
            { week: 1, day: 1, workoutId: u.workoutA, order: 1 },
            { week: 1, day: 2, workoutId: u.workoutA, order: 1 },
          ],
        }),
      );
    });
  });

  describe('C5: validação de campos', () => {
    let u: User;
    beforeAll(async () => {
      u = await signUp();
    });

    const cases: [string, (u: User) => Record<string, unknown>][] = [
      [
        'name ausente',
        (u) => {
          const b = weekly(u);
          delete (b as { name?: string }).name;
          return b;
        },
      ],
      ['name vazio', (u) => weekly(u, { name: '' })],
      ['name com 101 caracteres', (u) => weekly(u, { name: 'a'.repeat(101) })],
      ['cycleType inválido', (u) => weekly(u, { cycleType: 'MONTHLY' })],
      [
        'startDate ausente',
        (u) => {
          const b = weekly(u);
          delete (b as { startDate?: string }).startDate;
          return b;
        },
      ],
      ['startDate impossível', (u) => weekly(u, { startDate: '2026-02-30' })],
      [
        'startDate com hora',
        (u) => weekly(u, { startDate: '2026-11-02T10:00:00Z' }),
      ],
      [
        'workoutId que não é UUID',
        (u) =>
          weekly(u, {
            days: [{ week: 1, day: 1, workoutId: 'abc', order: 1 }],
          }),
      ],
      ['campo active no corpo', (u) => weekly(u, { active: true })],
    ];

    it.each(cases)('%s dá 400', async (_name, body) => {
      const res = await create(u, body(u));
      expect(res.status).toBe(400);
      expect(await countPrograms(u.id)).toBe(0);
    });

    it('name com 100 caracteres é aceito', async () => {
      const p = await createOk(u, weekly(u, { name: 'a'.repeat(100) }));
      expect(p.name).toHaveLength(100);
    });
  });

  it('C5: PATCH com null dá 400', async () => {
    const u = await signUp();
    const p = await createOk(u, weekly(u));
    for (const field of [
      'name',
      'cycleType',
      'cycleDays',
      'weeks',
      'startDate',
      'days',
    ]) {
      const res = await request(http())
        .patch(`/programs/${p.id}`)
        .set(auth(u))
        .send({ [field]: null });
      expect([field, res.status]).toEqual([field, 400]);
    }
    expect(await get(u, p.id)).toEqual(p);
  });

  it('C6: treino de outro usuário (ou inexistente) dá 400', async () => {
    const u = await signUp();
    const other = await signUp();

    for (const workoutId of [other.workoutA, randomUUID()]) {
      const res = await create(
        u,
        weekly(u, { days: [{ week: 1, day: 1, workoutId, order: 1 }] }),
      );
      expect(res.status).toBe(400);
      expect((res.body as { message: string }).message).toBe(
        'Treino não encontrado',
      );
    }
    expect(await countPrograms(u.id)).toBe(0);

    const p = await createOk(u, weekly(u));
    for (const workoutId of [other.workoutA, randomUUID()]) {
      const res = await request(http())
        .patch(`/programs/${p.id}`)
        .set(auth(u))
        .send({ days: [{ week: 1, day: 2, workoutId, order: 1 }] });
      expect(res.status).toBe(400);
      expect((res.body as { message: string }).message).toBe(
        'Treino não encontrado',
      );
    }
    expect((await get(u, p.id)).days).toEqual(p.days);
  });

  it('C7: isolamento na leitura', async () => {
    const u = await signUp();
    const other = await signUp();
    const mine = await createOk(u, weekly(u, { name: 'Meu' }));
    const theirs = await createOk(other, weekly(other, { name: 'Dele' }));

    const list = await request(http()).get('/programs').set(auth(u));
    expect(list.status).toBe(200);
    const body = list.body as ProgramResponse[];
    expect(body.map((p) => p.id)).toEqual([mine.id]);
    expect(body[0].days).toHaveLength(1);

    for (const id of [theirs.id, randomUUID()]) {
      const res = await request(http()).get(`/programs/${id}`).set(auth(u));
      expect(res.status).toBe(404);
      expect((res.body as { message: string }).message).toBe(
        'Programa não encontrado',
      );
    }

    const bad = await request(http()).get('/programs/abc').set(auth(u));
    expect(bad.status).toBe(400);
  });

  it('C8: edição parcial', async () => {
    const u = await signUp();
    const p = await createOk(u, weekly(u));

    const renamed = await request(http())
      .patch(`/programs/${p.id}`)
      .set(auth(u))
      .send({ name: 'Novo nome' });
    expect(renamed.status).toBe(200);
    const r = renamed.body as ProgramResponse;
    expect(r.name).toBe('Novo nome');
    expect(r.days).toEqual(p.days);

    const replaced = await request(http())
      .patch(`/programs/${p.id}`)
      .set(auth(u))
      .send({
        days: [
          { week: 1, day: 3, workoutId: u.workoutB, order: 1 },
          { week: 1, day: 6, workoutId: u.workoutA, order: 1 },
        ],
      });
    expect(replaced.status).toBe(200);
    expect(
      (replaced.body as ProgramResponse).days.map((d) => [d.day, d.workoutId]),
    ).toEqual([
      [3, u.workoutB],
      [6, u.workoutA],
    ]);
  });

  it('C8: estado final fora do limite dá 400', async () => {
    const u = await signUp();
    const p = await createOk(
      u,
      weekly(u, {
        weeks: 2,
        days: [
          { week: 1, day: 1, workoutId: u.workoutA, order: 1 },
          { week: 2, day: 1, workoutId: u.workoutB, order: 1 },
        ],
      }),
    );
    const res = await request(http())
      .patch(`/programs/${p.id}`)
      .set(auth(u))
      .send({ weeks: 1 });
    expect(res.status).toBe(400);
    expect(await get(u, p.id)).toEqual(p);
  });

  it('C8: trocar o tipo não completa campos', async () => {
    const u = await signUp();
    const p = await createOk(u, {
      name: 'Rotativo',
      cycleType: 'ROTATING',
      cycleDays: 5,
      startDate: '2026-11-16',
      days: [
        { week: 1, day: 1, workoutId: u.workoutA, order: 1 },
        { week: 1, day: 2, workoutId: u.workoutB, order: 1 },
        { week: 1, day: 4, workoutId: u.workoutA, order: 1 },
      ],
    });

    const bad = await request(http())
      .patch(`/programs/${p.id}`)
      .set(auth(u))
      .send({ cycleType: 'WEEKLY' });
    expect(bad.status).toBe(400);
    expect(await get(u, p.id)).toEqual(p);

    const ok = await request(http())
      .patch(`/programs/${p.id}`)
      .set(auth(u))
      .send({ cycleType: 'WEEKLY', cycleDays: 7 });
    expect(ok.status).toBe(200);
    expect(ok.body as ProgramResponse).toMatchObject({
      cycleType: 'WEEKLY',
      cycleDays: 7,
      weeks: 1,
    });
    expect((ok.body as ProgramResponse).days).toHaveLength(3);
  });

  it('C8: PATCH de outro usuário dá 404', async () => {
    const u = await signUp();
    const other = await signUp();
    const theirs = await createOk(other, weekly(other));
    const res = await request(http())
      .patch(`/programs/${theirs.id}`)
      .set(auth(u))
      .send({ name: 'Invadido' });
    expect(res.status).toBe(404);
    expect(await get(other, theirs.id)).toEqual(theirs);
  });

  it('C9: apaga e mantém treinos', async () => {
    const u = await signUp();
    const p = await createOk(u, weekly(u));
    await request(http())
      .post(`/programs/${p.id}/activate`)
      .set(auth(u))
      .expect(200);
    expect(await activeIds(u.id)).toEqual([p.id]);

    const res = await request(http()).delete(`/programs/${p.id}`).set(auth(u));
    expect(res.status).toBe(204);

    await request(http()).get(`/programs/${p.id}`).set(auth(u)).expect(404);
    const days = await prisma.$queryRaw<{ n: bigint }[]>`
      SELECT count(*) AS n FROM program_days WHERE program_id = ${p.id}`;
    expect(Number(days[0].n)).toBe(0);
    expect(await activeIds(u.id)).toEqual([]);

    const workouts = await request(http()).get('/workouts').set(auth(u));
    expect((workouts.body as { id: string }[]).map((w) => w.id).sort()).toEqual(
      [u.workoutA, u.workoutB].sort(),
    );
  });

  it('C9: DELETE de outro usuário dá 404', async () => {
    const u = await signUp();
    const other = await signUp();
    const theirs = await createOk(other, weekly(other));
    const res = await request(http())
      .delete(`/programs/${theirs.id}`)
      .set(auth(u));
    expect(res.status).toBe(404);
    expect(await get(other, theirs.id)).toEqual(theirs);
  });

  it('C10/C12: ativar troca o ativo e não afeta outro usuário', async () => {
    const u = await signUp();
    const other = await signUp();
    const first = await createOk(u, weekly(u, { name: 'Primeiro' }));
    const second = await createOk(u, weekly(u, { name: 'Segundo' }));
    const theirs = await createOk(other, weekly(other));
    await request(http())
      .post(`/programs/${theirs.id}/activate`)
      .set(auth(other))
      .expect(200);

    const a1 = await request(http())
      .post(`/programs/${first.id}/activate`)
      .set(auth(u));
    expect(a1.status).toBe(200);
    expect((a1.body as ProgramResponse).active).toBe(true);

    const a2 = await request(http())
      .post(`/programs/${second.id}/activate`)
      .set(auth(u));
    expect(a2.status).toBe(200);
    expect((a2.body as ProgramResponse).active).toBe(true);

    const list = await request(http()).get('/programs').set(auth(u));
    const byId = new Map(
      (list.body as ProgramResponse[]).map((p) => [p.id, p.active]),
    );
    expect(byId.get(first.id)).toBe(false);
    expect(byId.get(second.id)).toBe(true);

    const again = await request(http())
      .post(`/programs/${second.id}/activate`)
      .set(auth(u));
    expect(again.status).toBe(200);
    expect(await activeIds(u.id)).toEqual([second.id]);
    expect(await activeIds(other.id)).toEqual([theirs.id]);
  });

  it('C10: desativar deixa sem ativo', async () => {
    const u = await signUp();
    const p = await createOk(u, weekly(u));
    await request(http())
      .post(`/programs/${p.id}/activate`)
      .set(auth(u))
      .expect(200);

    const res = await request(http())
      .post(`/programs/${p.id}/deactivate`)
      .set(auth(u));
    expect(res.status).toBe(200);
    expect((res.body as ProgramResponse).active).toBe(false);
    expect(await activeIds(u.id)).toEqual([]);
  });

  it('C10: activate de outro usuário ou inexistente dá 404 sem mudar nenhum ativo', async () => {
    const u = await signUp();
    const other = await signUp();
    const mine = await createOk(u, weekly(u));
    const theirs = await createOk(other, weekly(other));
    await request(http())
      .post(`/programs/${mine.id}/activate`)
      .set(auth(u))
      .expect(200);
    await request(http())
      .post(`/programs/${theirs.id}/activate`)
      .set(auth(other))
      .expect(200);

    for (const id of [theirs.id, randomUUID()]) {
      for (const action of ['activate', 'deactivate']) {
        const res = await request(http())
          .post(`/programs/${id}/${action}`)
          .set(auth(u));
        expect([action, res.status]).toEqual([action, 404]);
      }
    }
    expect(await activeIds(u.id)).toEqual([mine.id]);
    expect(await activeIds(other.id)).toEqual([theirs.id]);
  });

  it('C11: ativações em paralelo deixam 1 ativo', async () => {
    const u = await signUp();
    const a = await createOk(u, weekly(u, { name: 'A' }));
    const b = await createOk(u, weekly(u, { name: 'B' }));

    const responses = await Promise.all(
      Array.from({ length: 10 }, (_, i) =>
        request(http())
          .post(`/programs/${i % 2 === 0 ? a.id : b.id}/activate`)
          .set(auth(u)),
      ),
    );
    expect(responses.map((r) => r.status)).toEqual(Array(10).fill(200));

    const rows = await prisma.$queryRaw<{ n: bigint }[]>`
      SELECT count(*) AS n FROM programs WHERE user_id = ${u.id} AND active`;
    expect(Number(rows[0].n)).toBe(1);
  });
});
