// Tarefa 8 (docs/plans/2026-11-11-progressao.md): progressão no item e GET /exercises/:id/last-performance.
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { randomUUID } from 'crypto';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import type { Server } from 'http';

type SetRow = {
  setNumber: number;
  weightKg: string | null;
  repsCompleted: number | null;
  durationSeconds: number | null;
  failed: boolean;
};
type Performance = {
  exerciseId: string;
  session: { id: string; startedAt: string; finishedAt: string } | null;
  sets: SetRow[];
  suggestion: { weightKg: string; increase: boolean; rule: string } | null;
};
type Item = {
  id: string;
  exerciseId: string;
  progressionType: string;
  progressionStepPercent: string | null;
};
type Workout = { id: string; items: Item[] };
type User = { id: string; token: string; exerciseId: string };
type SetInput = {
  weightKg?: number;
  repsCompleted?: number;
  failed?: boolean;
  exerciseId?: string;
};

describe('Progressão (tarefa 8)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const userIds: string[] = [];
  let catalogExerciseId: string;

  const http = () => app.getHttpServer() as Server;
  const auth = (u: User) => ({ Authorization: `Bearer ${u.token}` });

  const signUp = async (): Promise<User> => {
    const email = `prog8-${randomUUID()}@example.com`;
    const reg = await request(http())
      .post('/auth/register')
      .send({ name: 'Progressão', email, password: 'password123' })
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
      .set({ Authorization: `Bearer ${token}` })
      .send({ name: 'Supino 8', muscleGroup: 'chest' })
      .expect(201);
    return { id, token, exerciseId: (ex.body as { id: string }).id };
  };

  const item = (exerciseId: string, extra: Record<string, unknown> = {}) => ({
    exerciseId,
    order: 1,
    targetSets: 3,
    targetRepsMin: 8,
    targetRepsMax: 12,
    ...extra,
  });

  const postWorkout = (u: User, items: Record<string, unknown>[]) =>
    request(http())
      .post('/workouts')
      .set(auth(u))
      .send({ name: 'Treino 8', items });

  const createWorkout = async (u: User, items: Record<string, unknown>[]) => {
    const res = await postWorkout(u, items);
    expect(res.status).toBe(201);
    const id = (res.body as { id: string }).id;
    const get = await request(http()).get(`/workouts/${id}`).set(auth(u));
    return get.body as Workout;
  };

  // Abre, registra as séries e (se finishedAt) encerra uma sessão.
  const session = async (
    u: User,
    workoutId: string,
    startedAt: string,
    finishedAt: string | null,
    sets: SetInput[],
  ) => {
    const id = randomUUID();
    await request(http())
      .post('/sessions')
      .set(auth(u))
      .send({ id, workoutId, startedAt })
      .expect(201);
    let n = 0;
    for (const s of sets) {
      n += 1;
      await request(http())
        .post(`/sessions/${id}/sets`)
        .set(auth(u))
        .send({
          id: randomUUID(),
          exerciseId: s.exerciseId ?? u.exerciseId,
          setNumber: n,
          ...(s.weightKg !== undefined && { weightKg: s.weightKg }),
          ...(s.repsCompleted !== undefined && {
            repsCompleted: s.repsCompleted,
          }),
          ...(s.failed !== undefined && { failed: s.failed }),
        })
        .expect(201);
    }
    if (finishedAt) {
      await request(http())
        .patch(`/sessions/${id}`)
        .set(auth(u))
        .send({ finishedAt })
        .expect(200);
    }
    return id;
  };

  const perf = (u: User, exerciseId: string, workoutItemId?: string) =>
    request(http())
      .get(`/exercises/${exerciseId}/last-performance`)
      .query(workoutItemId ? { workoutItemId } : {})
      .set(auth(u));

  const perfOk = async (u: User, exerciseId: string, itemId?: string) => {
    const res = await perf(u, exerciseId, itemId);
    expect(res.status).toBe(200);
    return res.body as Performance;
  };

  const doubleSets: SetInput[] = [
    { weightKg: 40, repsCompleted: 15 },
    { weightKg: 60, repsCompleted: 12 },
    { weightKg: 60, repsCompleted: 12 },
    { weightKg: 60, repsCompleted: 12 },
  ];

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
    await app.listen(0);
    prisma = app.get(PrismaService);
    const catalog = await prisma.exercise.create({
      data: { name: 'Agachamento catálogo 8', muscleGroup: 'upper legs' },
    });
    catalogExerciseId = catalog.id;
  });

  afterAll(async () => {
    // FKs Restrict (C2/C3): séries → sessões → treinos → exercícios → usuários.
    for (const id of userIds) {
      await prisma.$executeRaw`DELETE FROM set_logs WHERE session_id IN (SELECT id FROM workout_sessions WHERE user_id = ${id})`;
      await prisma.$executeRaw`DELETE FROM workout_sessions WHERE user_id = ${id}`;
      await prisma.$executeRaw`DELETE FROM workouts WHERE user_id = ${id}`;
      await prisma.$executeRaw`DELETE FROM exercises WHERE user_id = ${id}`;
    }
    await prisma.$executeRaw`DELETE FROM exercises WHERE id = ${catalogExerciseId}`;
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    await prisma.$disconnect();
    await app.close();
  });

  describe('campos do item', () => {
    it('C1: campos de progressão no item', async () => {
      const u = await signUp();
      const w = await createWorkout(u, [
        item(u.exerciseId, {
          progressionType: 'DOUBLE',
          progressionStepPercent: 2.5,
        }),
        item(u.exerciseId, { order: 2 }),
      ]);
      expect(w.items[0]).toMatchObject({
        progressionType: 'DOUBLE',
        progressionStepPercent: '2.5',
      });
      expect(w.items[1]).toMatchObject({
        progressionType: 'NONE',
        progressionStepPercent: null,
      });
    });

    describe('C2: coerência da progressão', () => {
      let u: User;
      beforeAll(async () => {
        u = await signUp();
      });

      const cases: [string, (ex: string) => Record<string, unknown>, number][] =
        [
          [
            'DOUBLE sem passo',
            (ex) => item(ex, { progressionType: 'DOUBLE' }),
            400,
          ],
          [
            'LINEAR sem faixa',
            (ex) => ({
              exerciseId: ex,
              order: 1,
              targetSets: 3,
              targetDurationSeconds: 60,
              progressionType: 'LINEAR',
              progressionStepPercent: 2.5,
            }),
            400,
          ],
          [
            'NONE com passo',
            (ex) =>
              item(ex, {
                progressionType: 'NONE',
                progressionStepPercent: 2.5,
              }),
            400,
          ],
          ...(['0.5', '10.5', '2.3'].map((p) => [
            `passo ${p}`,
            (ex: string) =>
              item(ex, {
                progressionType: 'DOUBLE',
                progressionStepPercent: Number(p),
              }),
            400,
          ]) as [string, (ex: string) => Record<string, unknown>, number][]),
          [
            'progressionType inválido',
            (ex) =>
              item(ex, {
                progressionType: 'WAVE',
                progressionStepPercent: 2.5,
              }),
            400,
          ],
          [
            'progressionType null',
            (ex) => item(ex, { progressionType: null }),
            400,
          ],
          ...(['1', '9.5', '10'].map((p) => [
            `passo ${p} aceito`,
            (ex: string) =>
              item(ex, {
                progressionType: 'LINEAR',
                progressionStepPercent: Number(p),
              }),
            201,
          ]) as [string, (ex: string) => Record<string, unknown>, number][]),
          [
            'passo null com NONE aceito',
            (ex) => item(ex, { progressionStepPercent: null }),
            201,
          ],
        ];

      it.each(cases)('%s dá %s no POST e no PUT', async (_n, body, status) => {
        expect((await postWorkout(u, [body(u.exerciseId)])).status).toBe(
          status,
        );
        const w = await createWorkout(u, [item(u.exerciseId)]);
        const res = await request(http())
          .put(`/workouts/${w.id}`)
          .set(auth(u))
          .send({ items: [body(u.exerciseId)] });
        expect(res.status).toBe(status === 201 ? 200 : status);
      });
    });
  });

  describe('GET /exercises/:id/last-performance', () => {
    it('C3: sem token dá 401', async () => {
      const res = await request(http()).get(
        `/exercises/${randomUUID()}/last-performance`,
      );
      expect(res.status).toBe(401);
    });

    it('C4: sem histórico', async () => {
      const u = await signUp();
      expect(await perfOk(u, u.exerciseId)).toEqual({
        exerciseId: u.exerciseId,
        session: null,
        sets: [],
        suggestion: null,
      });
    });

    it('C5: última sessão encerrada, em qualquer treino', async () => {
      const u = await signUp();
      const other = await signUp();
      const a = await createWorkout(u, [item(u.exerciseId)]);
      const b = await createWorkout(u, [item(catalogExerciseId)]);

      await session(u, a.id, '2026-11-01T10:00:00Z', '2026-11-01T11:00:00Z', [
        { weightKg: 50, repsCompleted: 10 },
      ]);
      const s2 = await session(
        u,
        b.id,
        '2026-11-05T10:00:00Z',
        '2026-11-05T11:00:00Z',
        [
          { weightKg: 55, repsCompleted: 9 },
          { weightKg: 55.5, repsCompleted: 8, failed: true },
        ],
      );
      // S4: mais recente, encerrada, mas sem série do exercício.
      await session(u, b.id, '2026-11-07T10:00:00Z', '2026-11-07T11:00:00Z', [
        { weightKg: 100, repsCompleted: 5, exerciseId: catalogExerciseId },
      ]);
      // S3: aberta (em andamento).
      await session(u, a.id, '2026-11-10T10:00:00Z', null, [
        { weightKg: 70, repsCompleted: 3 },
      ]);
      // Outro usuário registra o mesmo exercício de catálogo depois (C6).
      const ow = await createWorkout(other, [item(catalogExerciseId)]);
      await session(
        other,
        ow.id,
        '2026-11-09T10:00:00Z',
        '2026-11-09T11:00:00Z',
        [{ weightKg: 200, repsCompleted: 1, exerciseId: catalogExerciseId }],
      );

      const p = await perfOk(u, u.exerciseId);
      expect(p.session?.id).toBe(s2);
      expect(p.sets).toEqual([
        {
          setNumber: 1,
          weightKg: '55',
          repsCompleted: 9,
          durationSeconds: null,
          failed: false,
        },
        {
          setNumber: 2,
          weightKg: '55.5',
          repsCompleted: 8,
          durationSeconds: null,
          failed: true,
        },
      ]);
      expect(p.suggestion).toBeNull();

      // C6: no exercício de catálogo, só as séries do próprio usuário (S4, 100 kg).
      const c = await perfOk(u, catalogExerciseId);
      expect(c.sets.map((s) => s.weightKg)).toEqual(['100']);
    });

    it('C5: desempate por finishedAt (P8)', async () => {
      const u = await signUp();
      const w = await createWorkout(u, [item(u.exerciseId)]);
      await session(u, w.id, '2026-11-03T10:00:00Z', '2026-11-03T12:00:00Z', [
        { weightKg: 30, repsCompleted: 10 },
      ]);
      const later = await session(
        u,
        w.id,
        '2026-11-03T10:00:00Z',
        '2026-11-03T13:00:00Z',
        [{ weightKg: 35, repsCompleted: 10 }],
      );
      await session(u, w.id, '2026-11-03T10:00:00Z', '2026-11-03T11:00:00Z', [
        { weightKg: 25, repsCompleted: 10 },
      ]);
      expect((await perfOk(u, u.exerciseId)).session?.id).toBe(later);
    });

    it('C6: isolamento', async () => {
      const u = await signUp();
      const other = await signUp();
      const theirs = await createWorkout(other, [item(other.exerciseId)]);
      const mine = await createWorkout(u, [
        item(u.exerciseId),
        item(catalogExerciseId, { order: 2 }),
      ]);

      for (const id of [other.exerciseId, randomUUID()]) {
        const res = await perf(u, id);
        expect(res.status).toBe(404);
        expect((res.body as { message: string }).message).toBe(
          'Exercício não encontrado',
        );
      }
      expect(
        (
          await request(http())
            .get('/exercises/abc/last-performance')
            .set(auth(u))
        ).status,
      ).toBe(400);

      for (const itemId of [theirs.items[0].id, randomUUID()]) {
        const res = await perf(u, u.exerciseId, itemId);
        expect(res.status).toBe(404);
        expect((res.body as { message: string }).message).toBe(
          'Item não encontrado',
        );
      }
      expect((await perf(u, u.exerciseId, 'abc')).status).toBe(400);

      const wrong = await perf(u, u.exerciseId, mine.items[1].id);
      expect(wrong.status).toBe(400);
      expect((wrong.body as { message: string }).message).toBe(
        'Item não é deste exercício',
      );
    });

    it('C7: dupla sobe e repete', async () => {
      const u = await signUp();
      const w = await createWorkout(u, [
        item(u.exerciseId, {
          progressionType: 'DOUBLE',
          progressionStepPercent: 2.5,
        }),
      ]);
      const itemId = w.items[0].id;

      await session(
        u,
        w.id,
        '2026-11-01T10:00:00Z',
        '2026-11-01T11:00:00Z',
        doubleSets,
      );
      const up = await perfOk(u, u.exerciseId, itemId);
      expect(up.sets).toHaveLength(4);
      expect(up.suggestion).toEqual({
        weightKg: '61.5',
        increase: true,
        rule: 'DOUBLE',
      });

      await session(u, w.id, '2026-11-02T10:00:00Z', '2026-11-02T11:00:00Z', [
        { weightKg: 60, repsCompleted: 12 },
        { weightKg: 60, repsCompleted: 11 },
        { weightKg: 60, repsCompleted: 12 },
      ]);
      expect((await perfOk(u, u.exerciseId, itemId)).suggestion).toEqual({
        weightKg: '60',
        increase: false,
        rule: 'DOUBLE',
      });
    });

    it('C9: sem workoutItemId não sugere', async () => {
      const u = await signUp();
      const w = await createWorkout(u, [
        item(u.exerciseId, {
          progressionType: 'DOUBLE',
          progressionStepPercent: 2.5,
        }),
      ]);
      await session(
        u,
        w.id,
        '2026-11-01T10:00:00Z',
        '2026-11-01T11:00:00Z',
        doubleSets,
      );
      const p = await perfOk(u, u.exerciseId);
      expect(p.sets).toHaveLength(4);
      expect(p.suggestion).toBeNull();
    });
  });
});
