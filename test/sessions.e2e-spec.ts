// Tarefa 3 (docs/produto.md): encerrar e corrigir sessão, registrar e corrigir série.
// Regras S3 (online: segunda sessão aberta dá 409), S4, S5, S8 e S9 de docs/domain.md; ADR 0013.
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { randomUUID } from 'crypto';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import type { Server } from 'http';

type Session = {
  id: string;
  userId: string;
  workoutId: string;
  startedAt: string;
  finishedAt: string | null;
};

type SetLog = {
  id: string;
  sessionId: string;
  exerciseId: string;
  setNumber: number;
  weightKg: string | null;
  repsCompleted: number | null;
  durationSeconds: number | null;
  failed: boolean;
};

const STARTED_AT = '2026-11-09T10:00:00.000Z';
const FINISHED_AT = '2026-11-09T11:00:00.000Z';

describe('Sessions e2e (séries e encerramento)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let exerciseId: string;
  let outsideExercise: string;
  const userIds: string[] = [];
  const exerciseIds: string[] = [];

  const http = () => app.getHttpServer() as Server;
  const auth = (token: string) => ({ Authorization: `Bearer ${token}` });

  const signUp = async () => {
    const email = `sess-${Date.now()}-${randomUUID()}@example.com`;
    const reg = await request(http())
      .post('/auth/register')
      .send({ name: 'Sessões', email, password: 'password123' })
      .expect(201);
    const id = (reg.body as { id: string }).id;
    userIds.push(id);
    const login = await request(http())
      .post('/auth/login')
      .send({ email, password: 'password123' })
      .expect(201);
    return { id, token: (login.body as { accessToken: string }).accessToken };
  };

  const createExercise = async (name: string) => {
    const exercise = await prisma.exercise.create({
      data: { name, muscleGroup: 'chest', type: 'strength' },
    });
    exerciseIds.push(exercise.id);
    return exercise.id;
  };

  const createRoutine = async (token: string, items?: unknown[]) => {
    const res = await request(http())
      .post('/workouts')
      .set(auth(token))
      .send({
        name: 'Ficha',
        items: items ?? [
          { exerciseId, order: 1, targetSets: 3, targetReps: 10 },
        ],
      })
      .expect(201);
    return (res.body as { id: string }).id;
  };

  const startSession = async (
    token: string,
    workoutId: string,
    id: string = randomUUID(),
  ) => {
    const res = await request(http())
      .post('/sessions')
      .set(auth(token))
      .send({ id, workoutId, startedAt: STARTED_AT });
    return { status: res.status, body: res.body as Session, id };
  };

  const patchSession = (token: string, id: string, payload: unknown) =>
    request(http())
      .patch(`/sessions/${id}`)
      .set(auth(token))
      .send(payload as object);

  const setBody = (extra: Record<string, unknown> = {}) => ({
    id: randomUUID(),
    exerciseId,
    setNumber: 1,
    ...extra,
  });

  const postSet = (token: string, sessionId: string, payload: unknown) =>
    request(http())
      .post(`/sessions/${sessionId}/sets`)
      .set(auth(token))
      .send(payload as object);

  const patchSet = (
    token: string,
    sessionId: string,
    setId: string,
    payload: unknown,
  ) =>
    request(http())
      .patch(`/sessions/${sessionId}/sets/${setId}`)
      .set(auth(token))
      .send(payload as object);

  // Usuário novo com ficha e uma sessão aberta.
  const userWithSession = async () => {
    const user = await signUp();
    const workoutId = await createRoutine(user.token);
    const session = await startSession(user.token, workoutId);
    expect(session.status).toBe(201);
    return { ...user, workoutId, sessionId: session.id };
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

    exerciseId = await createExercise('Sessões e2e');
    outsideExercise = await createExercise('Sessões e2e fora da ficha');
  });

  afterAll(async () => {
    // FKs Restrict: séries → sessões → exercícios (o próprio prende o dono) → usuários (fichas em cascata).
    await prisma.setLog.deleteMany({
      where: { workoutSession: { userId: { in: userIds } } },
    });
    await prisma.workoutSession.deleteMany({
      where: { userId: { in: userIds } },
    });
    // Treinos antes de exercícios e usuários: as FKs não apagam mais em cascata (C3).
    await prisma.workoutRoutine.deleteMany({
      where: { userId: { in: userIds } },
    });
    await prisma.exercise.deleteMany({ where: { id: { in: exerciseIds } } });
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    await prisma.$disconnect();
    await app.close();
  });

  describe('POST /sessions: S3 e S4', () => {
    it('C1: segunda sessão aberta dá 409 e nada é gravado', async () => {
      const u = await userWithSession();
      const second = await startSession(u.token, u.workoutId);
      expect(second.status).toBe(409);
      expect(
        await prisma.workoutSession.count({ where: { id: second.id } }),
      ).toBe(0);
      expect(
        await prisma.workoutSession.count({
          where: { userId: u.id, finishedAt: null },
        }),
      ).toBe(1);
    });

    it('C2: reenvio da aberta dá 200; depois de encerrar, id novo dá 201', async () => {
      const u = await userWithSession();
      const again = await startSession(u.token, u.workoutId, u.sessionId);
      expect(again.status).toBe(200);
      expect(again.body.id).toBe(u.sessionId);

      const closed = await patchSession(u.token, u.sessionId, {
        finishedAt: FINISHED_AT,
      });
      expect(closed.status).toBe(200);

      const next = await startSession(u.token, u.workoutId);
      expect(next.status).toBe(201);
    });

    it('C3: ficha vazia dá 400; reenvio de sessão já gravada continua 200', async () => {
      const user = await signUp();
      const empty = await createRoutine(user.token, []);
      const res = await startSession(user.token, empty);
      expect(res.status).toBe(400);
      expect(await prisma.workoutSession.count({ where: { id: res.id } })).toBe(
        0,
      );

      // Sessão gravada antes de a ficha ficar vazia (inserida direto no banco).
      const routine = await createRoutine(user.token);
      const id = randomUUID();
      await prisma.workoutSession.create({
        data: {
          id,
          userId: user.id,
          routineId: routine,
          startedAt: new Date(STARTED_AT),
        },
      });
      await prisma.routineItem.deleteMany({ where: { routineId: routine } });
      const again = await startSession(user.token, routine, id);
      expect(again.status).toBe(200);
      expect(again.body.id).toBe(id);
    });
  });

  describe('PATCH /sessions/:id', () => {
    it('C4: encerra e corrige datas; fim antes do início é aceito', async () => {
      const u = await userWithSession();
      const closed = await patchSession(u.token, u.sessionId, {
        finishedAt: '2026-11-09T08:00:00-03:00',
      });
      expect(closed.status).toBe(200);
      expect((closed.body as Session).finishedAt).toBe(FINISHED_AT);

      const fixed = await patchSession(u.token, u.sessionId, {
        startedAt: '2026-11-09T09:30:00.000Z',
        finishedAt: '2026-11-09T09:00:00.000Z',
      });
      expect(fixed.status).toBe(200);
      expect(fixed.body).toMatchObject({
        id: u.sessionId,
        startedAt: '2026-11-09T09:30:00.000Z',
        finishedAt: '2026-11-09T09:00:00.000Z',
      });
      const saved = await prisma.workoutSession.findUnique({
        where: { id: u.sessionId },
      });
      expect(saved?.finishedAt?.toISOString()).toBe('2026-11-09T09:00:00.000Z');
    });

    it('C5: não reabre e valida o body', async () => {
      const u = await userWithSession();
      expect(
        (await patchSession(u.token, u.sessionId, { finishedAt: FINISHED_AT }))
          .status,
      ).toBe(200);

      const invalid: unknown[] = [
        { finishedAt: null },
        { finishedAt: '2026-11-09T11:00:00' },
        { startedAt: '2026-11-09' },
        { workoutId: u.workoutId },
        { userId: randomUUID() },
        {},
      ];
      for (const payload of invalid) {
        const { status } = await patchSession(u.token, u.sessionId, payload);
        expect({ payload, status }).toEqual({ payload, status: 400 });
      }
      const saved = await prisma.workoutSession.findUnique({
        where: { id: u.sessionId },
      });
      expect(saved?.finishedAt?.toISOString()).toBe(FINISHED_AT);
    });

    it('C6: sessão de outro usuário ou inexistente dá 404 e nada muda', async () => {
      const a = await userWithSession();
      const b = await signUp();
      const res = await patchSession(b.token, a.sessionId, {
        finishedAt: FINISHED_AT,
      });
      expect(res.status).toBe(404);
      const saved = await prisma.workoutSession.findUnique({
        where: { id: a.sessionId },
      });
      expect(saved?.finishedAt).toBeNull();

      expect(
        (await patchSession(a.token, randomUUID(), { finishedAt: FINISHED_AT }))
          .status,
      ).toBe(404);

      // O dono, com o mesmo body, consegue: o 404 acima é por posse.
      expect(
        (await patchSession(a.token, a.sessionId, { finishedAt: FINISHED_AT }))
          .status,
      ).toBe(200);
    });
  });

  describe('POST /sessions/:id/sets', () => {
    it('C7: registra série completa e série só com obrigatórios', async () => {
      const u = await userWithSession();
      const full = setBody({
        weightKg: 82.5,
        repsCompleted: 10,
        durationSeconds: 45,
        failed: true,
      });
      const res = await postSet(u.token, u.sessionId, full);
      expect(res.status).toBe(201);
      expect(res.body).toMatchObject({
        id: full.id,
        sessionId: u.sessionId,
        exerciseId,
        setNumber: 1,
        weightKg: '82.5',
        repsCompleted: 10,
        durationSeconds: 45,
        failed: true,
      });

      const minimal = setBody({ setNumber: 2 });
      const res2 = await postSet(u.token, u.sessionId, minimal);
      expect(res2.status).toBe(201);
      expect(res2.body).toMatchObject({
        id: minimal.id,
        weightKg: null,
        repsCompleted: null,
        durationSeconds: null,
        failed: false,
      });
    });

    it('C8: série idempotente pelo id; id de outro usuário dá 409', async () => {
      const a = await userWithSession();
      const payload = setBody({ weightKg: 50, repsCompleted: 8 });
      const first = await postSet(a.token, a.sessionId, payload);
      expect(first.status).toBe(201);

      const again = await postSet(a.token, a.sessionId, {
        ...payload,
        weightKg: 60,
      });
      expect(again.status).toBe(200);
      expect(again.body).toEqual(first.body);

      const b = await userWithSession();
      const other = await postSet(b.token, b.sessionId, {
        ...payload,
        setNumber: 5,
      });
      expect(other.status).toBe(409);
      expect(JSON.stringify(other.body)).not.toContain(a.sessionId);

      const saved = await prisma.setLog.findUnique({
        where: { id: payload.id },
      });
      expect(saved?.weightKg?.toString()).toBe('50');
      expect(saved?.sessionId).toBe(a.sessionId);
    });

    it('C9: número de série duplicado dá 409', async () => {
      const u = await userWithSession();
      expect((await postSet(u.token, u.sessionId, setBody())).status).toBe(201);
      const dup = setBody();
      const res = await postSet(u.token, u.sessionId, dup);
      expect(res.status).toBe(409);
      expect(await prisma.setLog.count({ where: { id: dup.id } })).toBe(0);
    });

    it('C10: exercício fora da ficha é aceito; inexistente e sessão alheia dão 404', async () => {
      const a = await userWithSession();
      const outside = await postSet(
        a.token,
        a.sessionId,
        setBody({ exerciseId: outsideExercise }),
      );
      expect(outside.status).toBe(201);

      const missing = setBody({ exerciseId: randomUUID() });
      expect((await postSet(a.token, a.sessionId, missing)).status).toBe(404);
      expect(await prisma.setLog.count({ where: { id: missing.id } })).toBe(0);

      const b = await signUp();
      const foreign = setBody({ setNumber: 7 });
      expect((await postSet(b.token, a.sessionId, foreign)).status).toBe(404);
      expect((await postSet(b.token, randomUUID(), setBody())).status).toBe(
        404,
      );
      expect(await prisma.setLog.count({ where: { id: foreign.id } })).toBe(0);
    });

    it('C11: sessão encerrada aceita série nova', async () => {
      const u = await userWithSession();
      expect(
        (await patchSession(u.token, u.sessionId, { finishedAt: FINISHED_AT }))
          .status,
      ).toBe(200);
      expect((await postSet(u.token, u.sessionId, setBody())).status).toBe(201);
    });

    it('C12: validação da série dá 400 e nada é gravado', async () => {
      const u = await userWithSession();
      const invalid = [
        setBody({ weightKg: 10000 }),
        setBody({ weightKg: 1.234 }),
        setBody({ weightKg: -1 }),
        setBody({ setNumber: 0 }),
        setBody({ repsCompleted: -1 }),
        setBody({ durationSeconds: -1 }),
        setBody({ userId: randomUUID() }),
        setBody({ id: 'abc' }),
        { id: randomUUID(), setNumber: 1 },
      ];
      for (const payload of invalid) {
        const { status } = await postSet(u.token, u.sessionId, payload);
        expect({ payload, status }).toEqual({ payload, status: 400 });
      }
      expect(
        await prisma.setLog.count({ where: { sessionId: u.sessionId } }),
      ).toBe(0);
    });
  });

  describe('PATCH /sessions/:id/sets/:setId', () => {
    it('C13: corrige série, limpa campo com null e respeita posse e unicidade', async () => {
      const a = await userWithSession();
      const s1 = setBody({ weightKg: 40, repsCompleted: 10 });
      const s2 = setBody({ setNumber: 2 });
      expect((await postSet(a.token, a.sessionId, s1)).status).toBe(201);
      expect((await postSet(a.token, a.sessionId, s2)).status).toBe(201);

      const fixed = await patchSet(a.token, a.sessionId, s1.id, {
        weightKg: 42.5,
        repsCompleted: 9,
        durationSeconds: 30,
        failed: true,
        setNumber: 3,
      });
      expect(fixed.status).toBe(200);
      expect(fixed.body).toMatchObject({
        id: s1.id,
        weightKg: '42.5',
        repsCompleted: 9,
        durationSeconds: 30,
        failed: true,
        setNumber: 3,
      });

      const cleared = await patchSet(a.token, a.sessionId, s1.id, {
        weightKg: null,
      });
      expect(cleared.status).toBe(200);
      expect((cleared.body as SetLog).weightKg).toBeNull();

      expect(
        (
          await patchSet(a.token, a.sessionId, s1.id, {
            exerciseId: outsideExercise,
          })
        ).status,
      ).toBe(400);

      expect(
        (await patchSet(a.token, a.sessionId, s1.id, { setNumber: 2 })).status,
      ).toBe(409);

      const b = await userWithSession();
      expect(
        (await patchSet(b.token, a.sessionId, s1.id, { failed: false })).status,
      ).toBe(404);
      expect(
        (await patchSet(b.token, b.sessionId, s1.id, { failed: false })).status,
      ).toBe(404);

      const saved = await prisma.setLog.findUnique({ where: { id: s1.id } });
      expect(saved).toMatchObject({
        exerciseId,
        setNumber: 3,
        failed: true,
        weightKg: null,
      });
    });
  });

  it('C14: não existe rota que apague sessão ou série (404)', async () => {
    const u = await userWithSession();
    const set = setBody();
    expect((await postSet(u.token, u.sessionId, set)).status).toBe(201);

    expect(
      (
        await request(http())
          .delete(`/sessions/${u.sessionId}`)
          .set(auth(u.token))
      ).status,
    ).toBe(404);
    expect(
      (
        await request(http())
          .delete(`/sessions/${u.sessionId}/sets/${set.id}`)
          .set(auth(u.token))
      ).status,
    ).toBe(404);
    expect(await prisma.setLog.count({ where: { id: set.id } })).toBe(1);
  });

  // Sondas do revisor e do testador que quebraram a primeira versão.
  describe('casos de borda da revisão', () => {
    const INT4_MAX = 2147483647;

    it('inteiro acima do int4 dá 400 (não 500) no POST e no PATCH de série', async () => {
      const u = await userWithSession();
      for (const field of ['setNumber', 'repsCompleted', 'durationSeconds']) {
        const payload = setBody({ [field]: INT4_MAX + 1 });
        const { status } = await postSet(u.token, u.sessionId, payload);
        expect({ field, status }).toEqual({ field, status: 400 });
      }
      const set = setBody();
      expect((await postSet(u.token, u.sessionId, set)).status).toBe(201);
      for (const field of ['setNumber', 'repsCompleted', 'durationSeconds']) {
        const { status } = await patchSet(u.token, u.sessionId, set.id, {
          [field]: INT4_MAX + 1,
        });
        expect({ field, status }).toEqual({ field, status: 400 });
      }
      expect(
        (
          await postSet(
            u.token,
            u.sessionId,
            setBody({ setNumber: INT4_MAX, repsCompleted: INT4_MAX }),
          )
        ).status,
      ).toBe(201);
    });

    it('id de série já usado em outra sessão do mesmo usuário dá 409', async () => {
      const u = await userWithSession();
      const set = setBody();
      expect((await postSet(u.token, u.sessionId, set)).status).toBe(201);
      expect(
        (await patchSession(u.token, u.sessionId, { finishedAt: FINISHED_AT }))
          .status,
      ).toBe(200);
      const other = await startSession(u.token, u.workoutId);
      expect(other.status).toBe(201);

      const res = await postSet(u.token, other.id, set);
      expect(res.status).toBe(409);
      const saved = await prisma.setLog.findUnique({ where: { id: set.id } });
      expect(saved?.sessionId).toBe(u.sessionId);
    });

    it('data que passa do ano 9999 em UTC dá 400 e não apaga o encerramento', async () => {
      const u = await userWithSession();
      const late = '9999-12-31T23:59:59-01:00';

      const start = await startSession(u.token, u.workoutId);
      expect(start.status).toBe(409); // sessão aberta: confirma que o 400 abaixo vem da data
      const post = await request(http())
        .post('/sessions')
        .set(auth(u.token))
        .send({ id: randomUUID(), workoutId: u.workoutId, startedAt: late });
      expect(post.status).toBe(400);

      expect(
        (await patchSession(u.token, u.sessionId, { finishedAt: FINISHED_AT }))
          .status,
      ).toBe(200);
      for (const payload of [{ finishedAt: late }, { startedAt: late }]) {
        const { status } = await patchSession(u.token, u.sessionId, payload);
        expect({ payload, status }).toEqual({ payload, status: 400 });
      }
      const saved = await prisma.workoutSession.findUnique({
        where: { id: u.sessionId },
      });
      expect(saved?.finishedAt?.toISOString()).toBe(FINISHED_AT);

      expect(
        (
          await patchSession(u.token, u.sessionId, {
            finishedAt: '9999-12-31T23:59:59Z',
          })
        ).status,
      ).toBe(200);
    });

    it('PATCH de série com body vazio dá 400, como o de sessão', async () => {
      const u = await userWithSession();
      const set = setBody();
      expect((await postSet(u.token, u.sessionId, set)).status).toBe(201);
      expect((await patchSet(u.token, u.sessionId, set.id, {})).status).toBe(
        400,
      );
    });
  });

  // Tarefa 6 (C2): o campo antigo não é mais aceito.
  it('C2 (tarefa 6): routineId no body dá 400 e nada é gravado', async () => {
    const user = await signUp();
    const workoutId = await createRoutine(user.token);
    const id = randomUUID();
    const res = await request(http())
      .post('/sessions')
      .set(auth(user.token))
      .send({ id, routineId: workoutId, startedAt: STARTED_AT });
    expect(res.status).toBe(400);
    expect(await prisma.workoutSession.count({ where: { id } })).toBe(0);
  });

  // Tarefa 4: S8 — a série só aceita exercício do catálogo ou do próprio usuário.
  it('C5 (tarefa 4): série com exercício de outro usuário dá 404 e nada é gravado', async () => {
    const a = await userWithSession();
    const b = await signUp();
    const createOwn = async (token: string, name: string) => {
      const res = await request(http())
        .post('/exercises')
        .set(auth(token))
        .send({ name, muscleGroup: 'chest' })
        .expect(201);
      const id = (res.body as { id: string }).id;
      exerciseIds.push(id);
      return id;
    };
    const ofB = await createOwn(b.token, 'Sessões e2e próprio de B');
    const ofA = await createOwn(a.token, 'Sessões e2e próprio de A');

    const foreign = setBody({ exerciseId: ofB });
    const res = await postSet(a.token, a.sessionId, foreign);
    expect(res.status).toBe(404);
    expect((res.body as { message: string }).message).toBe(
      'Exercício não encontrado',
    );
    expect(await prisma.setLog.count({ where: { id: foreign.id } })).toBe(0);

    expect(
      (await postSet(a.token, a.sessionId, setBody({ exerciseId: ofA })))
        .status,
    ).toBe(201);
    expect(
      (await postSet(a.token, a.sessionId, setBody({ setNumber: 2 }))).status,
    ).toBe(201);
  });
});
