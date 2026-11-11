// Tarefa 9 (docs/plans/2026-11-11-perfil-e-usuario-ativo.md): GET e PATCH /me/profile.
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { randomUUID } from 'crypto';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import type { Server } from 'http';

type User = { id: string; token: string };
type Profile = {
  sex: string | null;
  birthDate: string | null;
  heightCm: number | null;
  timezone: string;
};

const DEFAULT: Profile = {
  sex: null,
  birthDate: null,
  heightCm: null,
  timezone: 'America/Sao_Paulo',
};

const HOUR = 60 * 60 * 1000;
const day = (ms: number) => new Date(ms).toISOString().slice(0, 10);

describe('Perfil do usuário (tarefa 9)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const userIds: string[] = [];

  const http = () => app.getHttpServer() as Server;

  const signUp = async (): Promise<User> => {
    const email = `perfil9-${randomUUID()}@example.com`;
    const reg = await request(http())
      .post('/auth/register')
      .send({ name: 'Perfil', email, password: 'password123' })
      .expect(201);
    const id = (reg.body as { id: string }).id;
    userIds.push(id);
    const login = await request(http())
      .post('/auth/login')
      .send({ email, password: 'password123' })
      .expect(201);
    return { id, token: (login.body as { accessToken: string }).accessToken };
  };

  const getProfile = (u: User) =>
    request(http())
      .get('/me/profile')
      .set('Authorization', `Bearer ${u.token}`);
  const patchProfile = (u: User, body: unknown) =>
    request(http())
      .patch('/me/profile')
      .set('Authorization', `Bearer ${u.token}`)
      .send(body as object);

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
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    await prisma.$disconnect();
    await app.close();
  });

  it('C1: perfil padrão de usuário recém-cadastrado, só com os 4 campos', async () => {
    const u = await signUp();
    const res = await getProfile(u);
    expect(res.status).toBe(200);
    expect(res.body).toEqual(DEFAULT);
  });

  it('C2: grava e devolve os 4 campos; o GET seguinte devolve o mesmo', async () => {
    const u = await signUp();
    const body: Profile = {
      sex: 'F',
      birthDate: '1990-05-20',
      heightCm: 168,
      timezone: 'America/Manaus',
    };
    const res = await patchProfile(u, body);
    expect(res.status).toBe(200);
    expect(res.body).toEqual(body);
    expect((await getProfile(u)).body).toEqual(body);
  });

  it('C3: parcial muda só o campo enviado; null limpa; {} não muda nada', async () => {
    const u = await signUp();
    const full: Profile = {
      sex: 'M',
      birthDate: '1985-01-02',
      heightCm: 180,
      timezone: 'Europe/Lisbon',
    };
    await patchProfile(u, full).expect(200);

    const partial = await patchProfile(u, { heightCm: 181 });
    expect(partial.status).toBe(200);
    expect(partial.body).toEqual({ ...full, heightCm: 181 });

    const empty = await patchProfile(u, {});
    expect(empty.status).toBe(200);
    expect(empty.body).toEqual({ ...full, heightCm: 181 });

    const cleared = await patchProfile(u, {
      sex: null,
      birthDate: null,
      heightCm: null,
    });
    expect(cleared.status).toBe(200);
    expect(cleared.body).toEqual({
      sex: null,
      birthDate: null,
      heightCm: null,
      timezone: 'Europe/Lisbon',
    });
    expect((await getProfile(u)).body).toEqual(cleared.body);
  });

  describe('C4: validação', () => {
    let u: User;
    const saved: Profile = {
      sex: 'F',
      birthDate: '1970-07-07',
      heightCm: 160,
      timezone: 'America/Recife',
    };

    beforeAll(async () => {
      u = await signUp();
      await patchProfile(u, saved).expect(200);
    });

    const tomorrowInUtcPlus14 = () => day(Date.now() + 14 * HOUR + 24 * HOUR);

    const invalid: Array<[string, () => Record<string, unknown>]> = [
      ['sex "X"', () => ({ sex: 'X' })],
      ['sex "f" (minúscula)', () => ({ sex: 'f' })],
      ['heightCm 99', () => ({ heightCm: 99 })],
      ['heightCm 251', () => ({ heightCm: 251 })],
      ['heightCm 170.5', () => ({ heightCm: 170.5 })],
      ['heightCm "170" (texto)', () => ({ heightCm: '170' })],
      ['birthDate 1899-12-31', () => ({ birthDate: '1899-12-31' })],
      [
        'birthDate no dia seguinte à data atual em UTC+14',
        () => ({ birthDate: tomorrowInUtcPlus14() }),
      ],
      ['birthDate impossível 2001-02-30', () => ({ birthDate: '2001-02-30' })],
      ['birthDate 01/02/2001', () => ({ birthDate: '01/02/2001' })],
      ['birthDate com hora', () => ({ birthDate: '2001-02-01T00:00:00Z' })],
      ['timezone inexistente', () => ({ timezone: 'Marte/Olympus' })],
      ['timezone deslocamento "+03:00"', () => ({ timezone: '+03:00' })],
      ['timezone deslocamento "-0300"', () => ({ timezone: '-0300' })],
      ['timezone vazio', () => ({ timezone: '' })],
      ['timezone null', () => ({ timezone: null })],
      ['timezone com 65 caracteres', () => ({ timezone: 'A'.repeat(65) })],
      ['campo desconhecido deactivatedAt', () => ({ deactivatedAt: null })],
      ['campo desconhecido email', () => ({ email: 'x@example.com' })],
    ];

    for (const [name, body] of invalid) {
      it(`400 e nada gravado: ${name}`, async () => {
        const res = await patchProfile(u, body());
        expect(res.status).toBe(400);
        expect((await getProfile(u)).body).toEqual(saved);
      });
    }

    const accepted: Array<[string, () => Record<string, unknown>]> = [
      ['heightCm 100', () => ({ heightCm: 100 })],
      ['heightCm 250', () => ({ heightCm: 250 })],
      ['birthDate 1900-01-01', () => ({ birthDate: '1900-01-01' })],
      ['birthDate hoje em UTC', () => ({ birthDate: day(Date.now()) })],
      ['timezone "UTC"', () => ({ timezone: 'UTC' })],
      ['timezone "Europe/Lisbon"', () => ({ timezone: 'Europe/Lisbon' })],
    ];

    for (const [name, body] of accepted) {
      it(`200 na borda, devolvido como enviado: ${name}`, async () => {
        const sent = body();
        const res = await patchProfile(u, sent);
        expect(res.status).toBe(200);
        expect(res.body).toMatchObject(sent);
      });
    }
  });

  it('C5: o PATCH de A não muda o perfil de B, e o GET de B devolve só o de B', async () => {
    const a = await signUp();
    const b = await signUp();
    await patchProfile(a, {
      sex: 'M',
      heightCm: 190,
      timezone: 'Asia/Tokyo',
    }).expect(200);
    const res = await getProfile(b);
    expect(res.status).toBe(200);
    expect(res.body).toEqual(DEFAULT);
  });

  it('C6: sem token ou com token inválido, GET e PATCH dão 401', async () => {
    await request(http()).get('/me/profile').expect(401);
    await request(http()).patch('/me/profile').send({}).expect(401);
    await request(http())
      .get('/me/profile')
      .set('Authorization', 'Bearer isto-nao-e-um-jwt')
      .expect(401);
    await request(http())
      .patch('/me/profile')
      .set('Authorization', 'Bearer isto-nao-e-um-jwt')
      .send({ heightCm: 170 })
      .expect(401);
  });
});
