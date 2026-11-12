// Tarefa 10b-2: importação de alimentos por CSV (POST /foods/import).
// Plano: docs/plans/2026-11-12-rendimento-e-csv.md (C13–C24).
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { randomUUID } from 'crypto';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import type { Server } from 'http';

type User = { id: string; token: string };
type Food = {
  id: string;
  name: string;
  state: string;
  kcal: string;
  proteinG: string;
  carbsG: string;
  fatG: string;
  fiberG: string | null;
  tags: string[];
};
type ImportError = {
  message: string;
  errors?: { line: number; message: string }[];
};

const HEADER_EN = 'name,state,kcal,proteinG,carbsG,fatG,fiberG,tags';
const HEADER_BR = 'name;state;kcal;proteinG;carbsG;fatG;fiberG;tags';

describe('Importação de alimentos por CSV (tarefa 10b-2)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const userIds: string[] = [];

  const http = () => app.getHttpServer() as Server;
  const auth = (u: User) => ({ Authorization: `Bearer ${u.token}` });

  const signUp = async (): Promise<User> => {
    const email = `import10b-${randomUUID()}@example.com`;
    const reg = await request(http())
      .post('/auth/register')
      .send({ name: 'Importação', email, password: 'password123' })
      .expect(201);
    const id = (reg.body as { id: string }).id;
    userIds.push(id);
    const login = await request(http())
      .post('/auth/login')
      .send({ email, password: 'password123' })
      .expect(201);
    return { id, token: (login.body as { accessToken: string }).accessToken };
  };

  const upload = (u: User, content: string | Buffer, name = 'alimentos.csv') =>
    request(http())
      .post('/foods/import')
      .set(auth(u))
      .attach(
        'file',
        typeof content === 'string' ? Buffer.from(content, 'utf8') : content,
        name,
      );
  const count = (u: User) => prisma.food.count({ where: { userId: u.id } });
  const mine = async (u: User, search: string) => {
    const res = await request(http())
      .get(`/foods?search=${encodeURIComponent(search)}`)
      .set(auth(u));
    expect(res.status).toBe(200);
    return res.body as Food[];
  };
  const errorLines = (body: unknown) =>
    ((body as ImportError).errors ?? []).map((e) => e.line);

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
    if (userIds.length) {
      await prisma.$executeRawUnsafe(
        'DELETE FROM foods WHERE user_id = ANY($1::text[])',
        userIds,
      );
    }
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    await prisma.$disconnect();
    await app.close();
  });

  it('C13: arquivo EN com 3 linhas → 201 { imported: 3 }; próprios do usuário, com os valores do arquivo', async () => {
    const u = await signUp();
    const other = await signUp();
    const tag = randomUUID().slice(0, 8);
    const csv = [
      HEADER_EN,
      `Arroz ${tag},RAW,360,7.2,79,0.6,1.6,VEGAN`,
      `Frango ${tag},COOKED,159,32,0,2.5,,`,
      `Feijão ${tag},COOKED,76,4.8,13.6,0.5,8.5,VEGAN|GLUTEN_FREE`,
    ].join('\n');
    const res = await upload(u, csv);
    expect(res.status).toBe(201);
    expect(res.body).toEqual({ imported: 3 });

    const foods = await mine(u, tag);
    expect(foods).toHaveLength(3);
    const arroz = foods.find((f) => f.name === `Arroz ${tag}`)!;
    expect(arroz).toMatchObject({
      state: 'RAW',
      kcal: '360',
      proteinG: '7.2',
      carbsG: '79',
      fatG: '0.6',
      fiberG: '1.6',
      tags: ['VEGAN'],
    });
    const frango = foods.find((f) => f.name === `Frango ${tag}`)!;
    expect(frango.fiberG).toBeNull();
    expect(frango.tags).toEqual([]);
    const feijao = foods.find((f) => f.name === `Feijão ${tag}`)!;
    expect([...feijao.tags].sort()).toEqual(['GLUTEN_FREE', 'VEGAN']);
    expect(await count(u)).toBe(3);
    expect(await mine(other, tag)).toHaveLength(0);
  });

  it('C14: padrão BR com BOM e \\r\\n → mesmos valores', async () => {
    const u = await signUp();
    const tag = randomUUID().slice(0, 8);
    const csv =
      '﻿' +
      [
        HEADER_BR,
        `Arroz ${tag};RAW;360;7,2;79;0,6;1,6;VEGAN`,
        `Feijão ${tag};COOKED;76;4,8;13,6;0,5;8,5;VEGAN|GLUTEN_FREE`,
      ].join('\r\n') +
      '\r\n';
    const res = await upload(u, csv);
    expect(res.status).toBe(201);
    expect(res.body).toEqual({ imported: 2 });
    const foods = await mine(u, tag);
    const arroz = foods.find((f) => f.name === `Arroz ${tag}`)!;
    expect(arroz).toMatchObject({
      proteinG: '7.2',
      fatG: '0.6',
      fiberG: '1.6',
    });
    const feijao = foods.find((f) => f.name === `Feijão ${tag}`)!;
    expect(feijao).toMatchObject({
      kcal: '76',
      proteinG: '4.8',
      carbsG: '13.6',
    });
  });

  it('C15: colunas em qualquer ordem, sem fiberG e tags, nomes entre aspas', async () => {
    const u = await signUp();
    const tag = randomUUID().slice(0, 8);
    const csv = [
      'state,fatG,name,kcal,carbsG,proteinG',
      `RAW,0.6,"Arroz, integral ${tag}",360,79,7`,
      `COOKED,1,"Pão ""francês"" ${tag}",300,58,8`,
    ].join('\n');
    const res = await upload(u, csv);
    expect(res.status).toBe(201);
    const foods = await mine(u, tag);
    const names = foods.map((f) => f.name).sort();
    expect(names).toEqual(
      [`Arroz, integral ${tag}`, `Pão "francês" ${tag}`].sort(),
    );
    for (const f of foods) {
      expect(f.fiberG).toBeNull();
      expect(f.tags).toEqual([]);
    }
  });

  it('C16: uma linha inválida no meio de 10 → 400 com a linha; nada criado', async () => {
    const u = await signUp();
    const rows = Array.from(
      { length: 10 },
      (_, i) => `Item ${i},COOKED,100,1,2,3,,`,
    );
    rows[4] = 'Item 4,COOKED,1000,1,2,3,,';
    const res = await upload(u, [HEADER_EN, ...rows].join('\n'));
    expect(res.status).toBe(400);
    expect(errorLines(res.body)).toEqual([6]);
    expect(await count(u)).toBe(0);
  });

  it('C16: célula vazia em coluna obrigatória → 400 na linha, não vira 0', async () => {
    const u = await signUp();
    const csv = [HEADER_EN, 'Ovo,COOKED,,13,1,10,,'].join('\n');
    const res = await upload(u, csv);
    expect(res.status).toBe(400);
    expect(errorLines(res.body)).toEqual([2]);
    expect(await count(u)).toBe(0);
  });

  it('C17: várias linhas inválidas → todas listadas, cada uma com a linha', async () => {
    const u = await signUp();
    const csv = [
      HEADER_EN,
      'Ok,COOKED,100,1,2,3,,',
      'Estado ruim,FRITO,100,1,2,3,,',
      'Ok 2,COOKED,100,1,2,3,,',
      'Soma,COOKED,100,50,50,1,,',
      ',COOKED,100,1,2,3,,',
      'Tag,COOKED,100,1,2,3,,KETO',
    ].join('\n');
    const res = await upload(u, csv);
    expect(res.status).toBe(400);
    expect(errorLines(res.body)).toEqual([3, 5, 6, 7]);
    for (const e of (res.body as ImportError).errors!) {
      expect(typeof e.message).toBe('string');
      expect(e.message.length).toBeGreaterThan(0);
    }
    expect(await count(u)).toBe(0);
  });

  describe('C18: cabeçalho inválido → 400 nomeando a coluna', () => {
    const cases: [string, string, string][] = [
      ['sem coluna obrigatória', 'name,state,kcal,proteinG,carbsG', 'fatG'],
      [
        'coluna desconhecida',
        'name,state,kcal,proteinG,carbsG,fatG,sodio',
        'sodio',
      ],
      ['coluna repetida', 'name,state,kcal,proteinG,carbsG,fatG,kcal', 'kcal'],
    ];
    for (const [title, header, column] of cases) {
      it(title, async () => {
        const u = await signUp();
        const row = header
          .split(',')
          .map(() => '1')
          .join(',');
        const res = await upload(u, `${header}\n${row}\n`);
        expect(res.status).toBe(400);
        expect(JSON.stringify(res.body)).toContain(column);
        expect(await count(u)).toBe(0);
      });
    }
  });

  it('C19: número de campos diferente do cabeçalho → 400 com a linha', async () => {
    const u = await signUp();
    const csv = [
      'name,state,kcal,proteinG,carbsG,fatG',
      'Ok,COOKED,100,1,2,3',
      'Curta,COOKED,100,1,2',
    ].join('\n');
    const res = await upload(u, csv);
    expect(res.status).toBe(400);
    expect(errorLines(res.body)).toEqual([3]);
    expect(await count(u)).toBe(0);
  });

  it('C19: aspas sem fechar → 400 com a linha', async () => {
    const u = await signUp();
    const csv = [
      'name,state,kcal,proteinG,carbsG,fatG',
      'Ok,COOKED,100,1,2,3',
      '"Aberta,COOKED,100,1,2,3',
    ].join('\n');
    const res = await upload(u, csv);
    expect(res.status).toBe(400);
    expect(errorLines(res.body)).toEqual([3]);
    expect(await count(u)).toBe(0);
  });

  it('C19: nome com quebra de linha é aceito e o erro seguinte cita a linha física', async () => {
    const u = await signUp();
    const csv = [
      'name,state,kcal,proteinG,carbsG,fatG',
      '"Arroz',
      'cozido",COOKED,128,2.5,28,0.2',
      'Ruim,COOKED,1000,1,2,3',
    ].join('\n');
    const res = await upload(u, csv);
    expect(res.status).toBe(400);
    expect(errorLines(res.body)).toEqual([4]);

    const ok = await upload(
      u,
      [
        'name,state,kcal,proteinG,carbsG,fatG',
        csv.split('\n').slice(1, 3).join('\n'),
      ].join('\n'),
    );
    expect(ok.status).toBe(201);
    expect(ok.body).toEqual({ imported: 1 });
  });

  describe('C20: arquivo vazio, só cabeçalho ou sem file → 400; linhas em branco ignoradas', () => {
    it('vazio', async () => {
      const u = await signUp();
      expect((await upload(u, '')).status).toBe(400);
    });
    it('só cabeçalho', async () => {
      const u = await signUp();
      expect((await upload(u, `${HEADER_EN}\n`)).status).toBe(400);
    });
    it('sem campo file', async () => {
      const u = await signUp();
      const res = await request(http())
        .post('/foods/import')
        .set(auth(u))
        .field('outro', 'x');
      expect(res.status).toBe(400);
    });
    it('linhas em branco no meio e no fim são ignoradas', async () => {
      const u = await signUp();
      const csv = `${HEADER_EN}\n\nA,COOKED,100,1,2,3,,\n\n\nB,COOKED,100,1,2,3,,\n\n`;
      const res = await upload(u, csv);
      expect(res.status).toBe(201);
      expect(res.body).toEqual({ imported: 2 });
    });
  });

  it('C21: 500 linhas → 201; 501 → 400 e nada criado', async () => {
    const u = await signUp();
    const rows = (n: number) =>
      Array.from({ length: n }, (_, i) => `Item ${i},COOKED,100,1,2,3,,`);
    const big = await upload(u, [HEADER_EN, ...rows(501)].join('\n'));
    expect(big.status).toBe(400);
    expect((big.body as ImportError).message).toBe(
      'Máximo de 500 alimentos por arquivo',
    );
    expect(await count(u)).toBe(0);

    const ok = await upload(u, [HEADER_EN, ...rows(500)].join('\n'));
    expect(ok.status).toBe(201);
    expect(ok.body).toEqual({ imported: 500 });
    expect(await count(u)).toBe(500);
  });

  it('C22: arquivo acima de 256 KB → 413', async () => {
    const u = await signUp();
    const csv = `${HEADER_EN}\n${'x'.repeat(262145)},COOKED,100,1,2,3,,\n`;
    const res = await upload(u, csv);
    expect(res.status).toBe(413);
    expect(await count(u)).toBe(0);
  });

  it('C22: arquivo que não é UTF-8 (Windows-1252) → 400 com a mensagem', async () => {
    const u = await signUp();
    const latin1 = Buffer.from(
      `${HEADER_EN}\nFeijão,COOKED,76,4.8,13.6,0.5,,\n`,
      'latin1',
    );
    const res = await upload(u, latin1);
    expect(res.status).toBe(400);
    expect((res.body as ImportError).message).toBe(
      'Arquivo precisa estar em UTF-8 (no Excel: salvar como CSV UTF-8)',
    );
    expect(await count(u)).toBe(0);
  });

  it('C23: formato do Google Planilhas em PT ("," e "4,8" entre aspas) → valores certos', async () => {
    const u = await signUp();
    const tag = randomUUID().slice(0, 8);
    const csv = [
      HEADER_EN,
      `Feijão ${tag},COOKED,76,"4,8","13,6","0,5","8,5",VEGAN`,
    ].join('\r\n');
    const res = await upload(u, csv);
    expect(res.status).toBe(201);
    const [feijao] = await mine(u, tag);
    expect(feijao).toMatchObject({
      name: `Feijão ${tag}`,
      proteinG: '4.8',
      carbsG: '13.6',
      fatG: '0.5',
      fiberG: '8.5',
    });
  });

  it('C23: número fora da forma aceita (1e2) → 400 na linha', async () => {
    const u = await signUp();
    const csv = [HEADER_EN, 'Ovo,COOKED,1e2,13,1,10,,'].join('\n');
    const res = await upload(u, csv);
    expect(res.status).toBe(400);
    expect(errorLines(res.body)).toEqual([2]);
    expect(await count(u)).toBe(0);
  });

  it('C24: sem token → 401; coluna userId → 400 de coluna desconhecida', async () => {
    const res = await request(http())
      .post('/foods/import')
      .attach(
        'file',
        Buffer.from(`${HEADER_EN}\nA,COOKED,1,1,1,1,,\n`),
        'a.csv',
      );
    expect(res.status).toBe(401);

    const u = await signUp();
    const other = await signUp();
    const csv = [`${HEADER_EN},userId`, `A,COOKED,1,1,1,1,,,${other.id}`].join(
      '\n',
    );
    const bad = await upload(u, csv);
    expect(bad.status).toBe(400);
    expect(JSON.stringify(bad.body)).toContain('userId');
    expect(await count(u)).toBe(0);
    expect(await count(other)).toBe(0);
  });
});
