import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { randomUUID } from 'crypto';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { Server } from 'http';

type RoutineResponse = {
  id: string;
  name: string;
  routineItems: RoutineItemResponse[];
};

type RoutineItemResponse = {
  id: string;
  order: number;
  targetSets: number;
  targetReps: number;
  exerciseId: string;
};

type RoutineListItem = {
  id: string;
  name: string;
  description: string | null;
  routineItems: Array<{
    id: string;
    order: number;
    targetSets: number;
    targetReps: number;
    exercices: {
      id: string;
      name: string;
      muscleGroup: string;
    };
  }>;
};

type RoutineDetailResponse = {
  id: string;
  name: string;
  routineItems: Array<{
    id: string;
    order: number;
    exercices: {
      name: string;
    };
  }>;
};

describe('Routines e2e', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let token: string;
  let exerciseId: string;
  let routineId: string;

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

    const email = `test-${Date.now()}@example.com`;
    await request(app.getHttpServer() as Server)
      .post('/auth/register')
      .send({ name: 'Tester', email, password: 'password123' })
      .expect(201);

    const loginRes = await request(app.getHttpServer() as Server)
      .post('/auth/login')
      .send({ email, password: 'password123' })
      .expect(201);

    const loginBody = loginRes.body as { accessToken: string };
    token = loginBody.accessToken;

    const exercise = await prisma.exercise.create({
      data: {
        name: 'Supino Reto',
        muscleGroup: 'chest',
        type: 'strength',
      },
    });
    exerciseId = exercise.id;
  });

  afterAll(async () => {
    await prisma.$disconnect();
    await app.close();
  });

  it('POST /routine -> deve criar uma ficha completa com exercicios planejados', async () => {
    const response = await request(app.getHttpServer() as Server)
      .post('/routine')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: 'Treino A - Peito e Tríceps',
        description: 'Foco em força',
        items: [
          {
            exerciseId,
            order: 1,
            targetSets: 4,
            targetReps: 10,
          },
        ],
      });

    const body = response.body as RoutineResponse;
    routineId = body.id;

    expect(response.status).toBe(201);
    expect(body).toHaveProperty('id');
    expect(body.name).toBe('Treino A - Peito e Tríceps');
    expect(body.routineItems).toHaveLength(1);
  });

  it('deve retornar 401 se nenhum token for fornecido', async () => {
    const response = await request(app.getHttpServer() as Server)
      .post('/routine')
      .send({
        name: 'Treino Inválido',
        items: [],
      });

    expect(response.status).toBe(401);
  });

  it('deve retornar 400 se o campo name estiver ausente', async () => {
    const response = await request(app.getHttpServer() as Server)
      .post('/routine')
      .set('Authorization', `Bearer ${token}`)
      .send({
        // name omitido de propósito
        description: 'Sem nome',
        items: [],
      });

    expect(response.status).toBe(400);
  });

  it('GET /routine -> deve listar apenas as rotinas do usuário autenticado', async () => {
    const response = await request(app.getHttpServer() as Server)
      .get('/routine')
      .set('Authorization', `Bearer ${token}`);

    const list = response.body as RoutineListItem[];

    expect(response.status).toBe(200);
    expect(Array.isArray(list)).toBe(true);
    expect(list.length).toBeGreaterThanOrEqual(1);
    expect(list[0]).toHaveProperty('id');
    expect(list[0]).toHaveProperty('routineItems');
    expect(list[0].routineItems[0]).toHaveProperty('exercices');
  });

  it('GET /routine:id -> deve listar apenas a rotina do usuário autenticado', async () => {
    const response = await request(app.getHttpServer() as Server)
      .get(`/routine/${routineId}`)
      .set('Authorization', `Bearer ${token}`);

    const body = response.body as RoutineDetailResponse;
    expect(body.id).toBe(routineId);
    expect(body.routineItems).toBeDefined();
  });

  it('PUT /routine:id -> deve dar update na rotina', async () => {
    const response = await request(app.getHttpServer() as Server)
      .put(`/routine/${routineId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: 'Treino A - Peito e Tríceps',
        description: 'Foco em força',
        items: [
          {
            exerciseId,
            order: 1,
            targetSets: 4,
            targetReps: 12,
          },
        ],
      });

    const body = response.body as RoutineResponse;
    routineId = body.id;

    expect(response.status).toBe(200);
    expect(body).toHaveProperty('id');
    expect(body.name).toBe('Treino A - Peito e Tríceps');
    expect(body.routineItems[0].targetReps).toBe(12);
  });

  // Tarefa 4: F6 — o item só aceita exercício do catálogo ou do próprio usuário.
  describe('F6: exercício visível ao usuário', () => {
    const userIds: string[] = [];
    const ownExerciseIds: string[] = [];
    let tokenA: string;
    let tokenB: string;
    let userB: string;
    let ownOfA: string;
    let ownOfB: string;

    const http = () => app.getHttpServer() as Server;
    const auth = (t: string) => ({ Authorization: `Bearer ${t}` });
    const item = (exId: string, order: number) => ({
      exerciseId: exId,
      order,
      targetSets: 3,
      targetReps: 10,
    });

    const signUp = async () => {
      const email = `f6-${Date.now()}-${Math.random()}@example.com`;
      const reg = await request(http())
        .post('/auth/register')
        .send({ name: 'F6', email, password: 'password123' })
        .expect(201);
      const id = (reg.body as { id: string }).id;
      userIds.push(id);
      const login = await request(http())
        .post('/auth/login')
        .send({ email, password: 'password123' })
        .expect(201);
      return { id, token: (login.body as { accessToken: string }).accessToken };
    };

    const createOwn = async (t: string, name: string) => {
      const res = await request(http())
        .post('/exercises')
        .set(auth(t))
        .send({ name, muscleGroup: 'chest' })
        .expect(201);
      const id = (res.body as { id: string }).id;
      ownExerciseIds.push(id);
      return id;
    };

    const postRoutine = (t: string, name: string, items: unknown[]) =>
      request(http()).post('/routine').set(auth(t)).send({ name, items });

    beforeAll(async () => {
      const a = await signUp();
      const b = await signUp();
      tokenA = a.token;
      tokenB = b.token;
      userB = b.id;
      ownOfA = await createOwn(tokenA, 'F6 próprio de A');
      ownOfB = await createOwn(tokenB, 'F6 próprio de B');
    });

    afterAll(async () => {
      // Exercício próprio prende o usuário (FK Restrict): exercícios antes dos usuários.
      await prisma.exercise.deleteMany({
        where: { id: { in: ownExerciseIds } },
      });
      await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    });

    it('C3: F6 no POST /routine', async () => {
      const foreign = await postRoutine(tokenB, 'F6 alheio', [item(ownOfA, 1)]);
      expect(foreign.status).toBe(400);
      expect((foreign.body as { message: string }).message).toBe(
        'Exercício não encontrado',
      );
      expect(
        await prisma.workoutRoutine.count({
          where: { userId: userB, name: 'F6 alheio' },
        }),
      ).toBe(0);

      const missing = await postRoutine(tokenB, 'F6 inexistente', [
        item(randomUUID(), 1),
      ]);
      expect(missing.status).toBe(400);
      expect((missing.body as { message: string }).message).toBe(
        'Exercício não encontrado',
      );

      // Catálogo, próprio e o mesmo exercício repetido (F5).
      const ok = await postRoutine(tokenB, 'F6 ok', [
        item(exerciseId, 1),
        item(ownOfB, 2),
        item(ownOfB, 3),
        item(exerciseId, 4),
      ]);
      expect(ok.status).toBe(201);
    });

    it('C4: F6 no PUT /routine', async () => {
      const created = await postRoutine(tokenB, 'F6 put', [
        item(exerciseId, 1),
      ]);
      expect(created.status).toBe(201);
      const routine = created.body as RoutineResponse;
      const before = routine.routineItems.map((i) => i.id);

      for (const exId of [ownOfA, randomUUID()]) {
        const res = await request(http())
          .put(`/routine/${routine.id}`)
          .set(auth(tokenB))
          .send({ items: [item(exId, 1)] });
        expect({ exId, status: res.status }).toEqual({ exId, status: 400 });
        expect((res.body as { message: string }).message).toBe(
          'Exercício não encontrado',
        );
        const items = await prisma.routineItem.findMany({
          where: { routineId: routine.id },
        });
        expect(items.map((i) => i.id).sort()).toEqual([...before].sort());
      }

      const ok = await request(http())
        .put(`/routine/${routine.id}`)
        .set(auth(tokenB))
        .send({
          items: [item(ownOfB, 1), item(ownOfB, 2), item(exerciseId, 3)],
        });
      expect(ok.status).toBe(200);
    });
  });
});
