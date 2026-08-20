import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import type { Server } from 'http';

type LoginResponse = {
  accessToken: string;
};

type UserResponse = {
  id: string;
  name: string;
  email: string;
};

describe('Auth e2e', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const email: string = `test-${Date.now()}@example.com`;
  const password: string = 'password123';

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
    await prisma.$disconnect();
    await app.close();
  });

  it('Post /auth/register -> Create a user', async () => {
    const userResponse = await request(app.getHttpServer() as Server)
      .post('/auth/register')
      .send({ name: 'Tester', email, password: password });

    const body = userResponse.body as UserResponse;
    expect(userResponse.status).toBe(201);
    expect(body).toHaveProperty('id');
    expect(body).toHaveProperty('name');
    expect(body).toHaveProperty('email');
    expect(body.name).toBe('Tester');
  });

  it('Post /auth/login -> user login', async () => {
    const userResponse = await request(app.getHttpServer() as Server)
      .post('/auth/login')
      .send({ email, password: password });

    const body = userResponse.body as LoginResponse;

    expect(userResponse.status).toBe(201);
    expect(body.accessToken).toBeDefined();
  });

  it('Post /auth/register -> Create a user duplicate', async () => {
    const userResponse = await request(app.getHttpServer() as Server)
      .post('/auth/register')
      .send({ name: 'Tester2', email, password: 'password321' });

    expect(userResponse.status).toBe(409);
  });

  it('Post /auth/login -> user wrong login password', async () => {
    const userResponse = await request(app.getHttpServer() as Server)
      .post('/auth/login')
      .send({ email, password: '123456' });

    expect(userResponse.status).toBe(401);
  });

  it('Post /auth/login -> user wrong login email', async () => {
    const userResponse = await request(app.getHttpServer() as Server)
      .post('/auth/login')
      .send({ email: 'wrongemail@test.com', password: password });

    expect(userResponse.status).toBe(401);
  });

  it('Post /auth/login -> user without login email', async () => {
    const userResponse = await request(app.getHttpServer() as Server)
      .post('/auth/login')
      .send({ email: '', password: password });

    expect(userResponse.status).toBe(400);
  });

  it('Post /auth/login -> user without login password', async () => {
    const userResponse = await request(app.getHttpServer() as Server)
      .post('/auth/login')
      .send({ email: email, password: '' });

    expect(userResponse.status).toBe(400);
  });
});
