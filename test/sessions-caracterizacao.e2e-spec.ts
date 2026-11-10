// Testes de caracterização do módulo sessions: travam o comportamento ATUAL.
// O que ainda contradiz docs/domain.md fica no bloco "comportamento atual (diverge de domain.md)".
// Achados (A1–A10): docs/plans/2026-10-19-auditoria-sessions.md. Contrato do POST /sessions: ADR 0013.
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
  routineId: string;
  startedAt: string;
  finishedAt: string | null;
};

const STARTED_AT = '2026-11-09T10:00:00.000Z';

describe('Sessions e2e (caracterização)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let tokenA: string;
  let tokenB: string;
  let userA: string;
  let userB: string;
  let exerciseId: string;
  let routineA: string;
  let routineB: string;
  const userIds: string[] = [];
  const exerciseIds: string[] = [];

  const http = () => app.getHttpServer() as Server;
  const auth = (token: string) => ({ Authorization: `Bearer ${token}` });

  const signUp = async (label: string) => {
    const email = `char-sess-${label}-${Date.now()}-${randomUUID()}@example.com`;
    const reg = await request(http())
      .post('/auth/register')
      .send({ name: `Char ${label}`, email, password: 'password123' })
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
      .post('/routine')
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

  // Corpo válido do POST /sessions: id e startedAt vêm do aparelho.
  const body = (routineId: string, extra: Record<string, unknown> = {}) => ({
    id: randomUUID(),
    routineId,
    startedAt: STARTED_AT,
    ...extra,
  });

  const startSession = async (
    token: string,
    payload: Record<string, unknown>,
  ) => {
    const res = await request(http())
      .post('/sessions')
      .set(auth(token))
      .send(payload);
    return { status: res.status, body: res.body as Session };
  };

  const sessionsOf = (routineId: string) =>
    prisma.workoutSession.count({ where: { routineId } });

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

    const a = await signUp('a');
    const b = await signUp('b');
    tokenA = a.token;
    userA = a.id;
    tokenB = b.token;
    userB = b.id;

    exerciseId = await createExercise('Caracterização sessions');

    routineA = await createRoutine(tokenA);
    routineB = await createRoutine(tokenB);
  });

  afterAll(async () => {
    // FKs do log são Restrict: séries → sessões → usuários (fichas em cascata) → exercícios.
    await prisma.setLog.deleteMany({
      where: { workoutSession: { userId: { in: userIds } } },
    });
    await prisma.workoutSession.deleteMany({
      where: { userId: { in: userIds } },
    });
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    await prisma.exercise.deleteMany({ where: { id: { in: exerciseIds } } });
    await prisma.$disconnect();
    await app.close();
  });

  describe('conforme domain.md', () => {
    it('401 sem token', async () => {
      const res = await request(http()).post('/sessions').send(body(routineA));
      expect(res.status).toBe(401);
    });

    it('C1: cria com id e startedAt do aparelho', async () => {
      const payload = body(routineA);
      const { status, body: res } = await startSession(tokenA, payload);
      expect(status).toBe(201);
      expect(Object.keys(res).sort()).toEqual(
        ['finishedAt', 'id', 'routineId', 'startedAt', 'userId'].sort(),
      );
      expect(res.id).toBe(payload.id);
      expect(res.userId).toBe(userA);
      expect(res.routineId).toBe(routineA);
      expect(res.startedAt).toBe(STARTED_AT);
      expect(res.finishedAt).toBeNull();
      expect(
        await prisma.workoutSession.count({ where: { id: payload.id } }),
      ).toBe(1);
    });

    it('C2: reenvio devolve a original', async () => {
      const otherRoutine = await createRoutine(tokenA);
      const payload = body(routineA);
      const first = await startSession(tokenA, payload);
      expect(first.status).toBe(201);

      // (a) startedAt diferente
      const again = await startSession(tokenA, {
        ...payload,
        startedAt: '2026-11-09T12:00:00.000Z',
      });
      expect(again.status).toBe(200);
      expect(again.body).toEqual(first.body);

      // (b) routineId de outra ficha própria
      const otherBody = await startSession(tokenA, {
        ...payload,
        routineId: otherRoutine,
      });
      expect(otherBody.status).toBe(200);
      expect(otherBody.body).toEqual(first.body);

      expect(
        await prisma.workoutSession.count({ where: { id: payload.id } }),
      ).toBe(1);
      expect(await sessionsOf(otherRoutine)).toBe(0);
    });

    it('C3: id de outro usuário dá 409', async () => {
      const payload = body(routineA);
      expect((await startSession(tokenA, payload)).status).toBe(201);
      const original = await prisma.workoutSession.findUnique({
        where: { id: payload.id },
      });

      for (const routineId of [routineB, routineA]) {
        const res = await request(http())
          .post('/sessions')
          .set(auth(tokenB))
          .send({
            id: payload.id,
            routineId,
            startedAt: '2026-11-09T12:00:00.000Z',
          });
        expect(res.status).toBe(409);
        const text = JSON.stringify(res.body);
        expect(text).not.toContain(userA);
        expect(text).not.toContain(routineA);
        expect(text).not.toContain(STARTED_AT);
        expect(text).not.toContain('2026-11-09T10:00');
      }

      const after = await prisma.workoutSession.findUnique({
        where: { id: payload.id },
      });
      expect(after).toEqual(original);
    });

    it('C2/C3: o id vale sem diferenciar maiúsculas e minúsculas', async () => {
      const lower = randomUUID();
      const upper = lower.toUpperCase();

      const first = await startSession(tokenA, body(routineA, { id: upper }));
      expect(first.status).toBe(201);
      expect(first.body.id).toBe(lower);

      const again = await startSession(tokenA, body(routineA, { id: lower }));
      expect(again.status).toBe(200);
      expect(again.body).toEqual(first.body);

      const other = await startSession(tokenB, body(routineB, { id: upper }));
      expect(other.status).toBe(409);

      expect(
        await prisma.workoutSession.count({
          where: { id: { in: [lower, upper] } },
        }),
      ).toBe(1);
    });

    it('C4: reenvio concorrente não duplica', async () => {
      const payload = body(routineA);
      const results = await Promise.all([
        startSession(tokenA, payload),
        startSession(tokenA, payload),
      ]);
      for (const { status } of results) {
        expect([200, 201]).toContain(status);
      }
      expect(
        await prisma.workoutSession.count({ where: { id: payload.id } }),
      ).toBe(1);
    });

    it('C5: formato de id e startedAt', async () => {
      const noId = { routineId: routineA, startedAt: STARTED_AT };
      const noStartedAt = { id: randomUUID(), routineId: routineA };
      const invalid: Record<string, unknown>[] = [
        noId,
        body(routineA, { id: 'abc' }),
        noStartedAt,
        body(routineA, { startedAt: 'ontem' }),
        body(routineA, { startedAt: '2026-11-09' }),
        body(routineA, { startedAt: '2026-11-09T10:00:00' }),
      ];
      for (const payload of invalid) {
        const { status } = await startSession(tokenA, payload);
        expect({ payload, status }).toEqual({ payload, status: 400 });
      }

      const withOffset = body(routineA, {
        startedAt: '2026-11-09T07:00:00-03:00',
      });
      const { status } = await startSession(tokenA, withOffset);
      expect(status).toBe(201);
      const saved = await prisma.workoutSession.findUnique({
        where: { id: withOffset.id },
      });
      expect(saved?.startedAt.toISOString()).toBe(STARTED_AT);
    });

    it('C5: data impossível em startedAt dá 400 e nada é gravado', async () => {
      for (const startedAt of [
        '2026-13-45T10:00:00Z',
        '2026-02-30T10:00:00Z',
        '2026-11-09T25:00:00Z',
      ]) {
        const payload = body(routineA, { startedAt });
        const { status } = await startSession(tokenA, payload);
        expect({ startedAt, status }).toEqual({ startedAt, status: 400 });
        expect(
          await prisma.workoutSession.count({ where: { id: payload.id } }),
        ).toBe(0);
      }
    });

    it('C6: startedAt não tem faixa', async () => {
      const payload = body(routineA, { startedAt: '2030-01-01T00:00:00.000Z' });
      const { status, body: res } = await startSession(tokenA, payload);
      expect(status).toBe(201);
      expect(res.startedAt).toBe('2030-01-01T00:00:00.000Z');
    });

    it('C7/F1: ficha de outro usuário dá 404 e nada é gravado', async () => {
      const before = await sessionsOf(routineB);
      const { status } = await startSession(tokenA, body(routineB));
      expect(status).toBe(404);
      expect(await sessionsOf(routineB)).toBe(before);
    });

    it('C7: ficha inexistente dá 404 e nada é gravado', async () => {
      const payload = body(randomUUID());
      const { status } = await startSession(tokenA, payload);
      expect(status).toBe(404);
      expect(
        await prisma.workoutSession.count({ where: { id: payload.id } }),
      ).toBe(0);
    });

    it('C7: routineId ausente ou inválido dá 400', async () => {
      const noRoutine = { id: randomUUID(), startedAt: STARTED_AT };
      expect((await startSession(tokenA, noRoutine)).status).toBe(400);
      expect(
        (await startSession(tokenA, body(routineA, { routineId: 'abc' })))
          .status,
      ).toBe(400);
    });

    it('C7: userId no body dá 400 e nada é gravado para o outro usuário', async () => {
      const { status } = await startSession(
        tokenA,
        body(routineA, { userId: userB }),
      );
      expect(status).toBe(400);
      expect(
        await prisma.workoutSession.count({ where: { userId: userB } }),
      ).toBe(0);
    });

    it('C7: finishedAt no body dá 400 (encerrar é outra rota)', async () => {
      const { status } = await startSession(
        tokenA,
        body(routineA, { finishedAt: '2026-11-09T11:00:00.000Z' }),
      );
      expect(status).toBe(400);
    });

    it('C7/S9: não existe rota que apague sessão (404)', async () => {
      const { status: created, body: res } = await startSession(
        tokenA,
        body(routineA),
      );
      expect(created).toBe(201);
      const del = await request(http())
        .delete(`/sessions/${res.id}`)
        .set(auth(tokenA));
      expect(del.status).toBe(404);
    });
  });

  describe('comportamento atual (diverge de domain.md)', () => {
    it('S2/S3 (A2): duas sessões com ids diferentes ficam abertas, com finishedAt null', async () => {
      const routine = await createRoutine(tokenA);
      const first = await startSession(tokenA, body(routine));
      const second = await startSession(tokenA, body(routine));
      expect(first.status).toBe(201);
      expect(second.status).toBe(201);
      expect(first.body.finishedAt).toBeNull();
      expect(second.body.finishedAt).toBeNull();
      expect(await sessionsOf(routine)).toBe(2);
    });

    it('S4 (A4): ficha sem itens inicia sessão (201)', async () => {
      const empty = await createRoutine(tokenA, []);
      const { status } = await startSession(tokenA, body(empty));
      expect(status).toBe(201);
    });

    it('S9 (A5): não há rotas de leitura nem de correção de sessão (404)', async () => {
      const { status: created, body: res } = await startSession(
        tokenA,
        body(routineA),
      );
      expect(created).toBe(201);
      const calls = [
        () => request(http()).get('/sessions').set(auth(tokenA)),
        () => request(http()).get(`/sessions/${res.id}`).set(auth(tokenA)),
        () =>
          request(http()).put(`/sessions/${res.id}`).set(auth(tokenA)).send({}),
        () =>
          request(http())
            .patch(`/sessions/${res.id}`)
            .set(auth(tokenA))
            .send({}),
      ];
      for (const call of calls) {
        expect((await call()).status).toBe(404);
      }
    });
  });

  describe('schema do log', () => {
    // Ainda não há rota de série: o schema é exercitado direto pelo Prisma.
    const newSession = (userId: string, routineId: string) =>
      prisma.workoutSession.create({
        data: {
          id: randomUUID(),
          userId,
          routineId,
          startedAt: new Date(STARTED_AT),
        },
      });

    it('C8: série com campos opcionais e carga Decimal(6,2)', async () => {
      const session = await newSession(userA, routineA);

      const empty = await prisma.setLog.create({
        data: {
          sessionId: session.id,
          exerciseId,
          setNumber: 1,
          weightKg: null,
          repsCompleted: null,
          durationSeconds: null,
        },
      });
      expect(empty.weightKg).toBeNull();
      expect(empty.repsCompleted).toBeNull();
      expect(empty.durationSeconds).toBeNull();

      const max = await prisma.setLog.create({
        data: {
          sessionId: session.id,
          exerciseId,
          setNumber: 2,
          weightKg: '9999.99',
          repsCompleted: 5,
        },
      });
      const readBack = await prisma.setLog.findUnique({
        where: { id: max.id },
      });
      expect(readBack?.weightKg?.toString()).toBe('9999.99');

      await expect(
        prisma.setLog.create({
          data: {
            sessionId: session.id,
            exerciseId,
            setNumber: 3,
            weightKg: '10000',
            repsCompleted: 5,
          },
        }),
      ).rejects.toThrow();
      expect(
        await prisma.setLog.count({
          where: { sessionId: session.id, setNumber: 3 },
        }),
      ).toBe(0);
    });

    it('C9: número da série único por sessão e exercício', async () => {
      const otherExercise = await createExercise('Caracterização sessions 2');
      const session = await newSession(userA, routineA);
      const set = {
        sessionId: session.id,
        exerciseId,
        setNumber: 1,
        weightKg: '50',
        repsCompleted: 10,
      };

      await prisma.setLog.create({ data: set });
      await expect(prisma.setLog.create({ data: set })).rejects.toMatchObject({
        code: 'P2002',
      });
      await expect(
        prisma.setLog.create({ data: { ...set, exerciseId: otherExercise } }),
      ).resolves.toBeDefined();
      expect(
        await prisma.setLog.count({ where: { sessionId: session.id } }),
      ).toBe(2);
    });

    it('C10: histórico não sai em cascata', async () => {
      const c = await signUp('c');
      const routineC = await createRoutine(c.token);
      const exerciseC = await createExercise('Caracterização sessions 3');
      const session = await newSession(c.id, routineC);
      const set = await prisma.setLog.create({
        data: {
          sessionId: session.id,
          exerciseId: exerciseC,
          setNumber: 1,
          weightKg: '20',
          repsCompleted: 8,
        },
      });

      const deletes = [
        () => prisma.workoutSession.delete({ where: { id: session.id } }),
        () => prisma.user.delete({ where: { id: c.id } }),
        () => prisma.workoutRoutine.delete({ where: { id: routineC } }),
        () => prisma.exercise.delete({ where: { id: exerciseC } }),
      ];
      for (const del of deletes) {
        await expect(del()).rejects.toMatchObject({ code: 'P2003' });
      }

      expect(await prisma.setLog.count({ where: { id: set.id } })).toBe(1);
      expect(
        await prisma.workoutSession.count({ where: { id: session.id } }),
      ).toBe(1);
      expect(await prisma.user.count({ where: { id: c.id } })).toBe(1);
      expect(
        await prisma.workoutRoutine.count({ where: { id: routineC } }),
      ).toBe(1);
      expect(await prisma.exercise.count({ where: { id: exerciseC } })).toBe(1);
    });
  });
});
