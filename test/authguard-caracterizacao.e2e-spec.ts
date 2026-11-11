// Testes de caracterização do AuthGuard: travam o comportamento ATUAL, sem corrigir nada.
// O guard é exercitado pela rota GET /exercises (só leitura, não grava nada).
// A tarefa 9 alinhou o guard ao C1 de docs/domain.md: não há mais bloco de divergência.
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import request from 'supertest';
import { randomUUID } from 'crypto';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import type { Server } from 'http';

describe('AuthGuard e2e (caracterização)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let jwt: JwtService;
  let userId: string;
  let validToken: string;

  const http = () => app.getHttpServer() as Server;
  const get = (authorization?: string) => {
    const req = request(http()).get('/exercises');
    return authorization ? req.set('Authorization', authorization) : req;
  };
  const b64 = (o: object) =>
    Buffer.from(JSON.stringify(o)).toString('base64url');

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
    jwt = app.get(JwtService);

    const email = `char-guard-${randomUUID()}@example.com`;
    const reg = await request(http())
      .post('/auth/register')
      .send({ name: 'Char guard', email, password: 'password123' })
      .expect(201);
    userId = (reg.body as { id: string }).id;
    const login = await request(http())
      .post('/auth/login')
      .send({ email, password: 'password123' })
      .expect(201);
    validToken = (login.body as { accessToken: string }).accessToken;
  });

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { id: userId } });
    await prisma.$disconnect();
    await app.close();
  });

  describe('recusa com 401 e a mensagem "Token inválido"', () => {
    const cases: Array<[string, () => string | undefined]> = [
      ['sem header Authorization', () => undefined],
      ['header vazio de token ("Bearer" sem valor)', () => 'Bearer'],
      ['esquema que não é Bearer (Basic)', () => `Basic ${validToken}`],
      ['token sem esquema', () => validToken],
      ['esquema em minúsculas ("bearer")', () => `bearer ${validToken}`],
      ['token malformado', () => 'Bearer isto-nao-e-um-jwt'],
      [
        'token com assinatura adulterada',
        () => `Bearer ${validToken.slice(0, -3)}abc`,
      ],
      [
        'token sem assinatura (alg none)',
        () =>
          `Bearer ${b64({ alg: 'none', typ: 'JWT' })}.${b64({ sub: randomUUID() })}.`,
      ],
    ];

    for (const [name, header] of cases) {
      it(name, async () => {
        const res = await get(header());
        expect(res.status).toBe(401);
        expect((res.body as { message: string }).message).toBe(
          'Token inválido',
        );
      });
    }

    it('token expirado', async () => {
      const expired = await jwt.signAsync(
        { sub: userId, email: 'x@example.com' },
        { expiresIn: '-10s' },
      );
      const res = await get(`Bearer ${expired}`);
      expect(res.status).toBe(401);
      expect((res.body as { message: string }).message).toBe('Token inválido');
    });

    it('token assinado com outro segredo', async () => {
      const other = await jwt.signAsync(
        { sub: userId, email: 'x@example.com' },
        { secret: `outro-${randomUUID()}` },
      );
      const res = await get(`Bearer ${other}`);
      expect(res.status).toBe(401);
    });
  });

  describe('aceita', () => {
    it('token válido emitido pelo login (200)', async () => {
      const res = await get(`Bearer ${validToken}`);
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });

    it('token do login carrega sub, email e validade de 7 dias (U6)', () => {
      const payload = jwt.decode<{
        sub: string;
        email: string;
        iat: number;
        exp: number;
      }>(validToken);
      expect(payload.sub).toBe(userId);
      expect(payload.email).toEqual(expect.stringContaining('char-guard-'));
      expect(payload.exp - payload.iat).toBe(7 * 24 * 60 * 60);
    });

    it('um token com sub de usuário existente aplica-se como userId nas rotas (lista 0 treinos)', async () => {
      const token = await jwt.signAsync({
        sub: userId,
        email: 'x@example.com',
      });
      const res = await request(http())
        .get('/workouts')
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(200);
      expect(res.body).toEqual([]);
    });
  });

  // C1 (tarefa 9): o guard consulta o usuário a cada pedido.
  describe('C1: usuário inexistente', () => {
    const expect401 = async (token: string) => {
      for (const path of ['/exercises', '/me/profile']) {
        const res = await request(http())
          .get(path)
          .set('Authorization', `Bearer ${token}`);
        expect(res.status).toBe(401);
        expect((res.body as { message: string }).message).toBe(
          'Token inválido',
        );
      }
    };

    it('token assinado cujo usuário não existe no banco → 401', async () => {
      const ghost = await jwt.signAsync({
        sub: randomUUID(),
        email: 'fantasma@example.com',
      });
      await expect401(ghost);
    });

    it('token do login depois de o usuário ser removido do banco → 401', async () => {
      const email = `char-guard-${randomUUID()}@example.com`;
      const reg = await request(http())
        .post('/auth/register')
        .send({ name: 'Char removido', email, password: 'password123' })
        .expect(201);
      const id = (reg.body as { id: string }).id;
      const login = await request(http())
        .post('/auth/login')
        .send({ email, password: 'password123' })
        .expect(201);
      const token = (login.body as { accessToken: string }).accessToken;

      await prisma.user.delete({ where: { id } });

      await expect401(token);
    });

    it('token assinado sem sub → 401 (não 500)', async () => {
      await expect401(await jwt.signAsync({ email: 'x@example.com' }));
    });

    it('token assinado com sub numérico → 401 (não 500)', async () => {
      await expect401(
        await jwt.signAsync({ sub: 123, email: 'x@example.com' }),
      );
    });
  });

  describe('C1: usuário desativado', () => {
    it('token válido de usuário desativado → 401; reativado, o mesmo token volta a valer', async () => {
      const email = `char-guard-${randomUUID()}@example.com`;
      const reg = await request(http())
        .post('/auth/register')
        .send({ name: 'Char desativado', email, password: 'password123' })
        .expect(201);
      const id = (reg.body as { id: string }).id;
      const login = await request(http())
        .post('/auth/login')
        .send({ email, password: 'password123' })
        .expect(201);
      const token = (login.body as { accessToken: string }).accessToken;
      const call = (path: string) =>
        request(http()).get(path).set('Authorization', `Bearer ${token}`);

      try {
        expect((await call('/exercises')).status).toBe(200);

        await prisma.$executeRaw`UPDATE users SET deactivated_at = now() WHERE id = ${id}`;
        for (const path of ['/exercises', '/me/profile']) {
          const res = await call(path);
          expect(res.status).toBe(401);
          expect((res.body as { message: string }).message).toBe(
            'Token inválido',
          );
        }

        await prisma.$executeRaw`UPDATE users SET deactivated_at = NULL WHERE id = ${id}`;
        expect((await call('/exercises')).status).toBe(200);
        expect((await call('/me/profile')).status).toBe(200);
      } finally {
        await prisma.user.deleteMany({ where: { id } });
      }
    });
  });
});
