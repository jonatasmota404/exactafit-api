// Testes de caracterização do módulo sessions: travam o comportamento ATUAL, sem corrigir nada.
// O que contradiz docs/domain.md fica no bloco "comportamento atual (diverge de domain.md)".
// Achados (A1–A10) e propostas de correção: docs/plans/2026-10-19-auditoria-sessions.md.
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
};

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

  const startSession = async (token: string, body: Record<string, unknown>) => {
    const res = await request(http())
      .post('/sessions')
      .set(auth(token))
      .send(body);
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

    const exercise = await prisma.exercise.create({
      data: {
        name: 'Caracterização sessions',
        muscleGroup: 'chest',
        type: 'strength',
      },
    });
    exerciseId = exercise.id;

    routineA = await createRoutine(tokenA);
    routineB = await createRoutine(tokenB);
  });

  afterAll(async () => {
    // Usuários levam fichas e sessões em cascata (FKs de hoje); o exercício sai por id.
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    await prisma.exercise.deleteMany({ where: { id: exerciseId } });
    await prisma.$disconnect();
    await app.close();
  });

  describe('conforme domain.md', () => {
    it('401 sem token', async () => {
      const res = await request(http())
        .post('/sessions')
        .send({ routineId: routineA });
      expect(res.status).toBe(401);
    });

    it('S1: cria a sessão na ficha própria, com userId do token, e grava no banco', async () => {
      const { status, body } = await startSession(tokenA, {
        routineId: routineA,
      });
      expect(status).toBe(201);
      expect(Object.keys(body).sort()).toEqual(
        ['id', 'routineId', 'startedAt', 'userId'].sort(),
      );
      expect(body.userId).toBe(userA);
      expect(body.routineId).toBe(routineA);
      const saved = await prisma.workoutSession.findUnique({
        where: { id: body.id },
      });
      expect(saved?.userId).toBe(userA);
    });

    it('F1: ficha de outro usuário dá 404 e nada é gravado', async () => {
      const before = await sessionsOf(routineB);
      const { status } = await startSession(tokenA, { routineId: routineB });
      expect(status).toBe(404);
      expect(await sessionsOf(routineB)).toBe(before);
    });

    it('ficha inexistente dá 404', async () => {
      const { status } = await startSession(tokenA, {
        routineId: randomUUID(),
      });
      expect(status).toBe(404);
    });

    it('routineId ausente ou inválido dá 400', async () => {
      expect((await startSession(tokenA, {})).status).toBe(400);
      expect((await startSession(tokenA, { routineId: 'abc' })).status).toBe(
        400,
      );
    });

    it('userId no body dá 400 e nada é gravado para o outro usuário', async () => {
      const { status } = await startSession(tokenA, {
        routineId: routineA,
        userId: userB,
      });
      expect(status).toBe(400);
      expect(
        await prisma.workoutSession.count({ where: { userId: userB } }),
      ).toBe(0);
    });

    it('S9: não existe rota que apague sessão (404)', async () => {
      const { body } = await startSession(tokenA, { routineId: routineA });
      const res = await request(http())
        .delete(`/sessions/${body.id}`)
        .set(auth(tokenA));
      expect(res.status).toBe(404);
    });
  });

  describe('comportamento atual (diverge de domain.md)', () => {
    it('S5/ADR 0004 (A1): id gerado no cliente é recusado com 400', async () => {
      const { status } = await startSession(tokenA, {
        id: randomUUID(),
        routineId: routineA,
      });
      expect(status).toBe(400);
    });

    it('ADR 0004/S3 (A1, A2): reenviar o mesmo body cria duas sessões com ids diferentes', async () => {
      const routine = await createRoutine(tokenA);
      const first = await startSession(tokenA, { routineId: routine });
      const second = await startSession(tokenA, { routineId: routine });
      expect(first.status).toBe(201);
      expect(second.status).toBe(201);
      expect(first.body.id).not.toBe(second.body.id);
      expect(await sessionsOf(routine)).toBe(2);
    });

    it('S2/S3 (A2): duas sessões seguidas ficam gravadas e nenhuma tem finishedAt', async () => {
      const routine = await createRoutine(tokenA);
      const first = await startSession(tokenA, { routineId: routine });
      const second = await startSession(tokenA, { routineId: routine });
      expect(first.body).not.toHaveProperty('finishedAt');
      expect(second.body).not.toHaveProperty('finishedAt');
      expect(await sessionsOf(routine)).toBe(2);
    });

    it('S1 (A3): startedAt no body dá 400; sem ele, vale o relógio do servidor', async () => {
      const refused = await startSession(tokenA, {
        routineId: routineA,
        startedAt: '2026-01-01T10:00:00.000Z',
      });
      expect(refused.status).toBe(400);

      const before = Date.now();
      const { status, body } = await startSession(tokenA, {
        routineId: routineA,
      });
      const after = Date.now();
      expect(status).toBe(201);
      const startedAt = new Date(body.startedAt).getTime();
      expect(startedAt).toBeGreaterThanOrEqual(before - 1000);
      expect(startedAt).toBeLessThanOrEqual(after + 1000);
    });

    it('S2 (A2): finishedAt no body dá 400', async () => {
      const { status } = await startSession(tokenA, {
        routineId: routineA,
        finishedAt: '2026-01-01T11:00:00.000Z',
      });
      expect(status).toBe(400);
    });

    it('S4 (A4): ficha sem itens inicia sessão (201)', async () => {
      const empty = await createRoutine(tokenA, []);
      const { status } = await startSession(tokenA, { routineId: empty });
      expect(status).toBe(201);
    });

    it('S9 (A5): não há rotas de leitura nem de correção de sessão (404)', async () => {
      const { body } = await startSession(tokenA, { routineId: routineA });
      const calls = [
        () => request(http()).get('/sessions').set(auth(tokenA)),
        () => request(http()).get(`/sessions/${body.id}`).set(auth(tokenA)),
        () =>
          request(http())
            .put(`/sessions/${body.id}`)
            .set(auth(tokenA))
            .send({}),
        () =>
          request(http())
            .patch(`/sessions/${body.id}`)
            .set(auth(tokenA))
            .send({}),
      ];
      for (const call of calls) {
        expect((await call()).status).toBe(404);
      }
    });
  });
});
