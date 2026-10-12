// Testes de caracterização do AuthGuard: travam o comportamento ATUAL, sem corrigir nada.
// O guard é exercitado pela rota GET /exercises (só leitura, não grava nada).
// O que contradiz docs/domain.md fica no bloco "comportamento atual (diverge de domain.md)".
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

    it('um token com sub aplica-se como userId nas rotas (sub aleatório lista 0 fichas)', async () => {
      const token = await jwt.signAsync({
        sub: randomUUID(),
        email: 'x@example.com',
      });
      const res = await request(http())
        .get('/routine')
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(200);
      expect(res.body).toEqual([]);
    });
  });

  describe('comportamento atual (diverge de domain.md)', () => {
    // C1: o AuthGuard deve consultar o usuário a cada pedido e recusar o desativado (401).
    // Hoje o guard só verifica a assinatura e não consulta o banco.
    it('C1: aceita token assinado cujo usuário não existe no banco (200)', async () => {
      const ghost = await jwt.signAsync({
        sub: randomUUID(),
        email: 'fantasma@example.com',
      });
      const res = await get(`Bearer ${ghost}`);
      expect(res.status).toBe(200);
    });

    it('C1: continua aceitando o token depois de o usuário ser removido do banco', async () => {
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

      const res = await get(`Bearer ${token}`);
      expect(res.status).toBe(200);
    });
  });

  // Não confirmado executando: fica como hipótese, sem afirmar.
  test.todo(
    'hipótese: com JWT_SECRET ausente, o guard passa undefined ao verifyAsync e o @nestjs/jwt cai no segredo do módulo (fallback fixo, U8); exige subir a app sem a variável',
  );
});
