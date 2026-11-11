// Tarefa 4 (docs/produto.md): exercício próprio e privado. Regras E1, E2 e C3 de docs/domain.md.
// Plano: docs/plans/2026-11-11-exercicio-proprio.md.
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
  userId?: string | null;
};

describe('Exercises e2e (exercício próprio)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let catalogId: string;
  const userIds: string[] = [];
  const exerciseIds: string[] = [];
  const tag = `Proprio-${randomUUID()}`;

  const http = () => app.getHttpServer() as Server;
  const auth = (token: string) => ({ Authorization: `Bearer ${token}` });

  const signUp = async () => {
    const email = `exe-${randomUUID()}@example.com`;
    const reg = await request(http())
      .post('/auth/register')
      .send({ name: 'Exercícios', email, password: 'password123' })
      .expect(201);
    const id = (reg.body as { id: string }).id;
    userIds.push(id);
    const login = await request(http())
      .post('/auth/login')
      .send({ email, password: 'password123' })
      .expect(201);
    return { id, token: (login.body as { accessToken: string }).accessToken };
  };

  const createOwn = async (token: string, body: Record<string, unknown>) => {
    const res = await request(http())
      .post('/exercises')
      .set(auth(token))
      .send(body);
    if (res.status === 201) exerciseIds.push((res.body as Exercise).id);
    return { status: res.status, body: res.body as Exercise };
  };

  const list = async (token: string) => {
    const res = await request(http()).get('/exercises').set(auth(token));
    expect(res.status).toBe(200);
    return res.body as Exercise[];
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

    // Catálogo: exercício sem dono, criado direto no banco.
    const catalog = await prisma.exercise.create({
      data: { name: `${tag} catálogo`, muscleGroup: 'chest' },
    });
    catalogId = catalog.id;
    exerciseIds.push(catalog.id);
  });

  afterAll(async () => {
    // Exercício próprio prende o usuário (FK Restrict): exercícios antes dos usuários.
    await prisma.exercise.deleteMany({ where: { id: { in: exerciseIds } } });
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    await prisma.$disconnect();
    await app.close();
  });

  it('C1: POST cria exercício próprio com userId do token; userId no body dá 400', async () => {
    const a = await signUp();
    const { status, body } = await createOwn(a.token, {
      name: `${tag} meu supino`,
      muscleGroup: 'chest',
    });
    expect(status).toBe(201);
    expect(body.userId).toBe(a.id);

    const b = await signUp();
    const forged = await createOwn(a.token, {
      name: `${tag} forjado`,
      muscleGroup: 'chest',
      userId: b.id,
    });
    expect(forged.status).toBe(400);
    expect(
      await prisma.exercise.count({ where: { name: `${tag} forjado` } }),
    ).toBe(0);
  });

  it('C2: GET lista catálogo + próprios, nunca exercício de outro usuário', async () => {
    const a = await signUp();
    const b = await signUp();
    const own = await createOwn(a.token, {
      name: `${tag} de A`,
      muscleGroup: 'back',
    });
    const other = await createOwn(b.token, {
      name: `${tag} de B`,
      muscleGroup: 'back',
    });
    expect(own.status).toBe(201);
    expect(other.status).toBe(201);

    const forA = await list(a.token);
    const ids = forA.map((e) => e.id);
    expect(ids).toContain(catalogId);
    expect(ids).toContain(own.body.id);
    expect(ids).not.toContain(other.body.id);
    for (const e of forA) {
      expect([null, a.id]).toContain(e.userId);
    }

    const forB = await list(b.token);
    expect(forB.map((e) => e.id)).not.toContain(own.body.id);
  });

  it('C6: usuário com exercício próprio não sai em cascata', async () => {
    const c = await signUp();
    const own = await createOwn(c.token, {
      name: `${tag} de C`,
      muscleGroup: 'waist',
    });
    expect(own.status).toBe(201);

    await expect(
      prisma.user.delete({ where: { id: c.id } }),
    ).rejects.toMatchObject({ code: 'P2003' });
    expect(await prisma.exercise.count({ where: { id: own.body.id } })).toBe(1);
    expect(await prisma.user.count({ where: { id: c.id } })).toBe(1);
  });
});
