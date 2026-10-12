// Testes de caracterização do módulo exercises: travam o comportamento ATUAL, sem corrigir nada.
// O que contradiz docs/domain.md fica no bloco "comportamento atual (diverge de domain.md)".
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { randomUUID } from 'crypto';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import type { Server } from 'http';

type Exercise = {
  id: string;
  name: string;
  muscleGroup: string;
  type: string;
};

describe('Exercises e2e (caracterização)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let tokenA: string;
  let tokenB: string;
  const userIds: string[] = [];
  const exerciseIds: string[] = [];
  const tag = `Char-${randomUUID()}`;

  const http = () => app.getHttpServer() as Server;
  const auth = (token: string) => ({ Authorization: `Bearer ${token}` });

  const signUp = async (label: string) => {
    const email = `char-${label}-${randomUUID()}@example.com`;
    const reg = await request(http())
      .post('/auth/register')
      .send({ name: `Char ${label}`, email, password: 'password123' })
      .expect(201);
    userIds.push((reg.body as { id: string }).id);
    const login = await request(http())
      .post('/auth/login')
      .send({ email, password: 'password123' })
      .expect(201);
    return (login.body as { accessToken: string }).accessToken;
  };

  const create = async (token: string, body: Record<string, unknown>) => {
    const res = await request(http())
      .post('/exercises')
      .set(auth(token))
      .send(body);
    const created = res.body as Exercise;
    if (res.status === 201) exerciseIds.push(created.id);
    return { status: res.status, body: created };
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
    tokenA = await signUp('a');
    tokenB = await signUp('b');
  });

  afterAll(async () => {
    await prisma.exercise.deleteMany({ where: { id: { in: exerciseIds } } });
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    await prisma.$disconnect();
    await app.close();
  });

  describe('autenticação', () => {
    it('401 sem token em POST e GET', async () => {
      const post = await request(http())
        .post('/exercises')
        .send({ name: tag, muscleGroup: 'chest' });
      const get = await request(http()).get('/exercises');
      expect(post.status).toBe(401);
      expect(get.status).toBe(401);
    });
  });

  describe('POST /exercises', () => {
    it('cria o exercício e devolve 201 com type padrão strength', async () => {
      const { status, body } = await create(tokenA, {
        name: `${tag} criar`,
        muscleGroup: 'chest',
      });
      expect(status).toBe(201);
      expect(body).toMatchObject({
        name: `${tag} criar`,
        muscleGroup: 'chest',
        type: 'strength',
      });
      expect(body.id).toEqual(expect.any(String));
    });

    it('grava o type informado', async () => {
      const { status, body } = await create(tokenA, {
        name: `${tag} cardio`,
        muscleGroup: 'cardio',
        type: 'cardio',
      });
      expect(status).toBe(201);
      expect(body.type).toBe('cardio');
    });

    it('aceita nome repetido (E5)', async () => {
      const first = await create(tokenA, {
        name: `${tag} repetido`,
        muscleGroup: 'back',
      });
      const second = await create(tokenA, {
        name: `${tag} repetido`,
        muscleGroup: 'back',
      });
      expect(first.status).toBe(201);
      expect(second.status).toBe(201);
      expect(second.body.id).not.toBe(first.body.id);
    });

    it('aceita name com exatamente 100 caracteres e recusa 101 (E3)', async () => {
      expect(
        (await create(tokenA, { name: 'x'.repeat(100), muscleGroup: 'back' }))
          .status,
      ).toBe(201);
      expect(
        (await create(tokenA, { name: 'x'.repeat(101), muscleGroup: 'back' }))
          .status,
      ).toBe(400);
    });

    it('400 sem name, sem muscleGroup ou com valores vazios', async () => {
      const bodies = [
        { muscleGroup: 'chest' },
        { name: tag },
        { name: '', muscleGroup: 'chest' },
        { name: tag, muscleGroup: '' },
      ];
      for (const body of bodies) {
        expect((await create(tokenA, body)).status).toBe(400);
      }
    });

    it('400 com tipos errados, muscleGroup ou type acima de 100 e campo desconhecido', async () => {
      const bodies = [
        { name: 123, muscleGroup: 'chest' },
        { name: tag, muscleGroup: 'x'.repeat(101) },
        { name: tag, muscleGroup: 'chest', type: 'x'.repeat(101) },
        { name: tag, muscleGroup: 'chest', userId: randomUUID() },
      ];
      for (const body of bodies) {
        expect((await create(tokenA, body)).status).toBe(400);
      }
    });
  });

  describe('GET /exercises', () => {
    it('lista os exercícios criados, com as entidades do Prisma (inclui createdAt e updatedAt)', async () => {
      const { body } = await create(tokenA, {
        name: `${tag} listar`,
        muscleGroup: 'legs',
      });
      const res = await request(http()).get('/exercises').set(auth(tokenA));
      const found = (res.body as Exercise[]).find((e) => e.id === body.id);

      expect(res.status).toBe(200);
      expect(found).toMatchObject({
        id: body.id,
        name: `${tag} listar`,
        muscleGroup: 'legs',
        type: 'strength',
      });
      expect(found).toHaveProperty('createdAt');
      expect(found).toHaveProperty('updatedAt');
    });
  });

  describe('rotas inexistentes', () => {
    it('não há PUT nem DELETE /exercises/:id (404)', async () => {
      const { body } = await create(tokenA, {
        name: `${tag} sem-rota`,
        muscleGroup: 'chest',
      });
      const put = await request(http())
        .put(`/exercises/${body.id}`)
        .set(auth(tokenA))
        .send({ name: 'x' });
      const del = await request(http())
        .delete(`/exercises/${body.id}`)
        .set(auth(tokenA));
      expect(put.status).toBe(404);
      expect(del.status).toBe(404);
    });
  });

  describe('comportamento atual (diverge de domain.md)', () => {
    // E1/E2: exercício criado por usuário pertence só a ele. Hoje não há dono e todos veem todos.
    it('E1/E2: exercício criado pelo usuário A aparece na listagem do usuário B', async () => {
      const { body } = await create(tokenA, {
        name: `${tag} sem-dono`,
        muscleGroup: 'chest',
      });
      const res = await request(http()).get('/exercises').set(auth(tokenB));
      const ids = (res.body as Exercise[]).map((e) => e.id);

      expect(body).not.toHaveProperty('userId');
      expect(ids).toContain(body.id);
    });

    // E4: muscleGroup aceita só os 10 valores de body_part e type sai. Hoje é texto livre.
    it('E4: aceita muscleGroup fora da lista de body_part (201)', async () => {
      const { status, body } = await create(tokenA, {
        name: `${tag} livre`,
        muscleGroup: 'qualquer coisa',
      });
      expect(status).toBe(201);
      expect(body.muscleGroup).toBe('qualquer coisa');
    });

    it('E4: aceita type no POST (domain.md manda recusar com 400)', async () => {
      const { status } = await create(tokenA, {
        name: `${tag} type`,
        muscleGroup: 'chest',
        type: 'mobilidade',
      });
      expect(status).toBe(201);
    });
  });
});
