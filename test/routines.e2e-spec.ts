import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
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
});
