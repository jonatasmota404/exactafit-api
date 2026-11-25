// Tarefa 17a-1: uma sessão aberta por usuário no banco (S3) e trava no início online.
// Critérios C10 (corridas só online) e C11 do plano docs/plans/2026-11-25-sincronismo.md;
// movidos de test/sync.e2e-spec.ts quando o 17a foi dividido em dois PRs.
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { randomUUID } from 'crypto';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import type { Server } from 'http';

type User = {
  id: string;
  token: string;
  exerciseId: string;
  workoutId: string; // com itens
  emptyWorkoutId: string; // sem itens
};

const T = (h: number) =>
  new Date(Date.UTC(2026, 10, 20, h, 0, 0)).toISOString(); // 2026-11-20Thh:00Z

describe('Uma sessão aberta por usuário (tarefa 17a-1)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const userIds: string[] = [];

  const http = () => app.getHttpServer() as Server;
  const auth = (u: User) => ({ Authorization: `Bearer ${u.token}` });

  const signUp = async (): Promise<User> => {
    const email = `sync17-${randomUUID()}@example.com`;
    const reg = await request(http())
      .post('/auth/register')
      .send({ name: 'Sync', email, password: 'password123' })
      .expect(201);
    const id = (reg.body as { id: string }).id;
    userIds.push(id);
    const login = await request(http())
      .post('/auth/login')
      .send({ email, password: 'password123' })
      .expect(201);
    const token = (login.body as { accessToken: string }).accessToken;
    const h = { Authorization: `Bearer ${token}` };
    const ex = await request(http())
      .post('/exercises')
      .set(h)
      .send({
        name: `Supino ${randomUUID().slice(0, 8)}`,
        muscleGroup: 'chest',
      })
      .expect(201);
    const exerciseId = (ex.body as { id: string }).id;
    const w = await request(http())
      .post('/workouts')
      .set(h)
      .send({
        name: 'Treino A',
        items: [
          {
            exerciseId,
            order: 1,
            targetSets: 3,
            targetRepsMin: 10,
            targetRepsMax: 10,
          },
        ],
      })
      .expect(201);
    const empty = await request(http())
      .post('/workouts')
      .set(h)
      .send({ name: 'Rascunho', items: [] })
      .expect(201);
    return {
      id,
      token,
      exerciseId,
      workoutId: (w.body as { id: string }).id,
      emptyWorkoutId: (empty.body as { id: string }).id,
    };
  };

  const startOnline = (u: User, id: string, startedAt: string) =>
    request(http())
      .post('/sessions')
      .set(auth(u))
      .send({ id, workoutId: u.workoutId, startedAt });

  const openOf = (u: User) =>
    prisma.workoutSession.findMany({
      where: { userId: u.id, finishedAt: null },
    });
  const counts = async (u: User) => ({
    sessions: await prisma.workoutSession.count({ where: { userId: u.id } }),
    sets: await prisma.setLog.count({
      where: { workoutSession: { userId: u.id } },
    }),
  });

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
    // Histórico sem cascade (ADR 0001): séries → sessões → treinos → exercícios → usuários.
    if (userIds.length) {
      await prisma.$executeRawUnsafe(
        `DELETE FROM set_logs WHERE session_id IN
           (SELECT id FROM workout_sessions WHERE user_id = ANY($1::text[]))`,
        userIds,
      );
      for (const table of ['workout_sessions', 'workouts', 'exercises']) {
        await prisma.$executeRawUnsafe(
          `DELETE FROM ${table} WHERE user_id = ANY($1::text[])`,
          userIds,
        );
      }
    }
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    await prisma.$disconnect();
    await app.close();
  });

  describe('C10: uma aberta por usuário sob concorrência (só online)', () => {
    it('dois POST /sessions simultâneos com ids diferentes: 201 e 409', async () => {
      const u = await signUp();
      const res = await Promise.all([
        startOnline(u, randomUUID(), T(1)),
        startOnline(u, randomUUID(), T(2)),
      ]);
      expect(res.map((r) => r.status).sort()).toEqual([201, 409]);
      const conflict = res.find((r) => r.status === 409)!;
      expect((conflict.body as { message: string }).message).toBe(
        'Já existe uma sessão aberta',
      );
      expect(await openOf(u)).toHaveLength(1);
    });

    it('dois POST /sessions simultâneos com o mesmo id: 201 e 200', async () => {
      const u = await signUp();
      const id = randomUUID();
      const res = await Promise.all([
        startOnline(u, id, T(1)),
        startOnline(u, id, T(1)),
      ]);
      expect(res.map((r) => r.status).sort()).toEqual([200, 201]);
      expect((await counts(u)).sessions).toBe(1);
    });
  });

  it('C11: o banco recusa uma segunda sessão aberta do mesmo usuário', async () => {
    const u = await signUp();
    expect((await startOnline(u, randomUUID(), T(1))).status).toBe(201);
    await expect(
      prisma.$executeRawUnsafe(
        `INSERT INTO workout_sessions (id, user_id, workout_id, started_at)
         VALUES ($1, $2, $3, now())`,
        randomUUID(),
        u.id,
        u.workoutId,
      ),
    ).rejects.toThrow(/workout_sessions_one_open_per_user|unique/i);
    expect(await openOf(u)).toHaveLength(1);
  });
});
