// Testes de caracterização do módulo routines: travam o comportamento ATUAL, sem corrigir nada.
// O que contradiz docs/domain.md fica no bloco "comportamento atual (diverge de domain.md)".
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { randomUUID } from 'crypto';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import type { Server } from 'http';

type Item = {
  id: string;
  exerciseId: string;
  order: number;
  targetSets: number;
  targetReps: number;
  exercices?: { id: string; name: string };
};
type Routine = {
  id: string;
  userId: string;
  name: string;
  description: string | null;
  routineItems: Item[];
};
type ItemInput = {
  exerciseId: string;
  order: number;
  targetSets: number;
  targetReps: number;
};

describe('Routines e2e (caracterização)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let tokenA: string;
  let tokenB: string;
  const userIds: string[] = [];
  const exerciseIds: string[] = [];
  let exerciseId: string;
  let otherExerciseId: string;

  const http = () => app.getHttpServer() as Server;
  const auth = (token: string) => ({ Authorization: `Bearer ${token}` });
  const item = (
    order: number,
    overrides: Partial<ItemInput> = {},
  ): ItemInput => ({
    exerciseId,
    order,
    targetSets: 3,
    targetReps: 10,
    ...overrides,
  });

  const signUp = async (label: string) => {
    const email = `char-${label}-${Date.now()}-${randomUUID()}@example.com`;
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

  const createRoutine = async (
    token: string,
    body: Record<string, unknown> = {},
  ) => {
    const res = await request(http())
      .post('/routine')
      .set(auth(token))
      .send({ name: 'Ficha', items: [item(1)], ...body });
    return { status: res.status, body: res.body as Routine };
  };

  const getRoutine = async (token: string, id: string) => {
    const res = await request(http()).get(`/routine/${id}`).set(auth(token));
    return { status: res.status, body: res.body as Routine };
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

    const [e1, e2] = await Promise.all(
      ['Caracterização 1', 'Caracterização 2'].map((name) =>
        prisma.exercise.create({
          data: { name, muscleGroup: 'chest', type: 'strength' },
        }),
      ),
    );
    exerciseId = e1.id;
    otherExerciseId = e2.id;
    exerciseIds.push(e1.id, e2.id);
  });

  afterAll(async () => {
    // Usuários levam fichas e itens em cascata; exercícios criados aqui saem por id.
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    await prisma.exercise.deleteMany({ where: { id: { in: exerciseIds } } });
    await prisma.$disconnect();
    await app.close();
  });

  describe('autenticação', () => {
    it('401 sem token em todas as rotas', async () => {
      const id = randomUUID();
      const calls = [
        () => request(http()).post('/routine').send({ name: 'x', items: [] }),
        () => request(http()).get('/routine'),
        () => request(http()).get(`/routine/${id}`),
        () => request(http()).put(`/routine/${id}`).send({ name: 'x' }),
      ];
      for (const call of calls) {
        expect((await call()).status).toBe(401);
      }
    });
  });

  describe('POST /routine', () => {
    it('cria a ficha com itens e devolve 201 sem os dados do exercício', async () => {
      const { status, body } = await createRoutine(tokenA, {
        name: 'Treino A',
        description: 'Foco em força',
      });
      expect(status).toBe(201);
      expect(body.name).toBe('Treino A');
      expect(body.description).toBe('Foco em força');
      expect(body.userId).toBe(userIds[0]);
      expect(body.routineItems).toHaveLength(1);
      expect(body.routineItems[0].exerciseId).toBe(exerciseId);
      expect(body.routineItems[0]).not.toHaveProperty('exercices');
    });

    it('aceita ficha sem itens (rascunho, F3)', async () => {
      const { status, body } = await createRoutine(tokenA, { items: [] });
      expect(status).toBe(201);
      expect(body.routineItems).toEqual([]);
    });

    it('aceita o mesmo exercício duas vezes com order diferente (F5)', async () => {
      const { status, body } = await createRoutine(tokenA, {
        items: [item(1), item(2)],
      });
      expect(status).toBe(201);
      expect(body.routineItems).toHaveLength(2);
    });

    it('400 sem name, com name vazio ou com mais de 100 caracteres (F2)', async () => {
      for (const name of [undefined, '', 'x'.repeat(101)]) {
        const res = await request(http())
          .post('/routine')
          .set(auth(tokenA))
          .send({ name, items: [] });
        expect(res.status).toBe(400);
      }
    });

    it('400 com description acima de 255 caracteres (F2)', async () => {
      const { status } = await createRoutine(tokenA, {
        description: 'x'.repeat(256),
      });
      expect(status).toBe(400);
    });

    it('400 sem items, com campo desconhecido ou com exerciseId que não é UUID', async () => {
      const semItems = await request(http())
        .post('/routine')
        .set(auth(tokenA))
        .send({ name: 'x' });
      expect(semItems.status).toBe(400);

      const extra = await createRoutine(tokenA, { userId: userIds[1] });
      expect(extra.status).toBe(400);

      const naoUuid = await createRoutine(tokenA, {
        items: [item(1, { exerciseId: 'abc' })],
      });
      expect(naoUuid.status).toBe(400);
    });

    it('400 com order, targetSets ou targetReps não inteiros', async () => {
      for (const field of ['order', 'targetSets', 'targetReps'] as const) {
        const { status } = await createRoutine(tokenA, {
          items: [{ ...item(1), [field]: 1.5 }],
        });
        expect(status).toBe(400);
      }
    });

    it('o userId vem do token: o body não define o dono', async () => {
      const { body } = await createRoutine(tokenB);
      expect(body.userId).toBe(userIds[1]);
    });
  });

  describe('GET /routine', () => {
    it('lista só as fichas do usuário autenticado', async () => {
      const a = await createRoutine(tokenA, { name: 'Lista A' });
      const b = await createRoutine(tokenB, { name: 'Lista B' });

      const resA = await request(http()).get('/routine').set(auth(tokenA));
      const resB = await request(http()).get('/routine').set(auth(tokenB));
      const idsA = (resA.body as Routine[]).map((r) => r.id);
      const idsB = (resB.body as Routine[]).map((r) => r.id);

      expect(resA.status).toBe(200);
      expect(idsA).toContain(a.body.id);
      expect(idsA).not.toContain(b.body.id);
      expect(idsB).toContain(b.body.id);
      expect(idsB).not.toContain(a.body.id);
    });

    it('devolve os itens em ordem crescente de order, com os dados do exercício (F7)', async () => {
      const { body } = await createRoutine(tokenA, {
        items: [item(3), item(1, { exerciseId: otherExerciseId }), item(2)],
      });
      const res = await request(http()).get('/routine').set(auth(tokenA));
      const found = (res.body as Routine[]).find((r) => r.id === body.id);

      expect(found?.routineItems.map((i) => i.order)).toEqual([1, 2, 3]);
      expect(found?.routineItems[0].exercices?.id).toBe(otherExerciseId);
    });
  });

  describe('GET /routine/:id', () => {
    it('detalha a ficha própria com itens ordenados e exercício', async () => {
      const { body } = await createRoutine(tokenA, {
        items: [item(2), item(1)],
      });
      const res = await getRoutine(tokenA, body.id);

      expect(res.status).toBe(200);
      expect(res.body.id).toBe(body.id);
      expect(res.body.routineItems.map((i) => i.order)).toEqual([1, 2]);
      expect(res.body.routineItems[0].exercices?.id).toBe(exerciseId);
    });

    it('404 para ficha de outro usuário (F1)', async () => {
      const { body } = await createRoutine(tokenA);
      const res = await getRoutine(tokenB, body.id);
      expect(res.status).toBe(404);
    });

    it('404 para id inexistente e 400 para id que não é UUID', async () => {
      expect((await getRoutine(tokenA, randomUUID())).status).toBe(404);
      expect((await getRoutine(tokenA, 'nao-e-uuid')).status).toBe(400);
    });
  });

  describe('PUT /routine/:id', () => {
    it('atualiza name e description e mantém os itens quando items não vem (F8)', async () => {
      const created = await createRoutine(tokenA, { items: [item(1)] });
      const res = await request(http())
        .put(`/routine/${created.body.id}`)
        .set(auth(tokenA))
        .send({ name: 'Novo nome', description: 'Nova descrição' });
      const body = res.body as Routine;

      expect(res.status).toBe(200);
      expect(body.name).toBe('Novo nome');
      expect(body.description).toBe('Nova descrição');
      expect(body.routineItems.map((i) => i.id)).toEqual(
        created.body.routineItems.map((i) => i.id),
      );
    });

    it('aceita body vazio e não altera nada', async () => {
      const created = await createRoutine(tokenA, { name: 'Intacta' });
      const res = await request(http())
        .put(`/routine/${created.body.id}`)
        .set(auth(tokenA))
        .send({});
      expect(res.status).toBe(200);
      expect((res.body as Routine).name).toBe('Intacta');
    });

    it('com items, substitui todos os itens e eles ganham ids novos (F8)', async () => {
      const created = await createRoutine(tokenA, {
        items: [item(1), item(2)],
      });
      const res = await request(http())
        .put(`/routine/${created.body.id}`)
        .set(auth(tokenA))
        .send({ items: [item(1, { targetReps: 12 })] });
      const body = res.body as Routine;
      const oldIds = created.body.routineItems.map((i) => i.id);

      expect(res.status).toBe(200);
      expect(body.routineItems).toHaveLength(1);
      expect(body.routineItems[0].targetReps).toBe(12);
      expect(oldIds).not.toContain(body.routineItems[0].id);
    });

    it('com items vazio, remove todos os itens', async () => {
      const created = await createRoutine(tokenA, { items: [item(1)] });
      const res = await request(http())
        .put(`/routine/${created.body.id}`)
        .set(auth(tokenA))
        .send({ items: [] });
      expect(res.status).toBe(200);
      expect((res.body as Routine).routineItems).toEqual([]);
    });

    it('404 para ficha de outro usuário e nada é alterado (F1)', async () => {
      const created = await createRoutine(tokenA, { name: 'Da A' });
      const res = await request(http())
        .put(`/routine/${created.body.id}`)
        .set(auth(tokenB))
        .send({ name: 'Invadida', items: [] });
      expect(res.status).toBe(404);

      const after = await getRoutine(tokenA, created.body.id);
      expect(after.body.name).toBe('Da A');
      expect(after.body.routineItems).toHaveLength(1);
    });

    it('404 para id inexistente e 400 para id que não é UUID', async () => {
      const put = (id: string) =>
        request(http())
          .put(`/routine/${id}`)
          .set(auth(tokenA))
          .send({ name: 'x' });
      expect((await put(randomUUID())).status).toBe(404);
      expect((await put('nao-e-uuid')).status).toBe(400);
    });

    it('400 com name vazio ou campo desconhecido', async () => {
      const created = await createRoutine(tokenA);
      const put = (body: Record<string, unknown>) =>
        request(http())
          .put(`/routine/${created.body.id}`)
          .set(auth(tokenA))
          .send(body);
      expect((await put({ name: '' })).status).toBe(400);
      expect((await put({ foo: 'bar' })).status).toBe(400);
    });

    // Caso de borda 1: name null deve dar 400 e a ficha não muda.
    it('caso 1: 400 com name null e o name da ficha não muda', async () => {
      const created = await createRoutine(tokenA, { name: 'Com nome' });
      const res = await request(http())
        .put(`/routine/${created.body.id}`)
        .set(auth(tokenA))
        .send({ name: null });
      expect(res.status).toBe(400);
      expect((await getRoutine(tokenA, created.body.id)).body.name).toBe(
        'Com nome',
      );
    });

    it('200 só com description (sem name) e o name é mantido', async () => {
      const created = await createRoutine(tokenA, { name: 'Com nome' });
      const res = await request(http())
        .put(`/routine/${created.body.id}`)
        .set(auth(tokenA))
        .send({ description: 'nova' });
      expect(res.status).toBe(200);
      const after = await getRoutine(tokenA, created.body.id);
      expect(after.body.name).toBe('Com nome');
      expect(after.body.description).toBe('nova');
    });

    it('400 com name de 101 caracteres', async () => {
      const created = await createRoutine(tokenA, { name: 'Com nome' });
      const res = await request(http())
        .put(`/routine/${created.body.id}`)
        .set(auth(tokenA))
        .send({ name: 'a'.repeat(101) });
      expect(res.status).toBe(400);
      expect((await getRoutine(tokenA, created.body.id)).body.name).toBe(
        'Com nome',
      );
    });
  });

  describe('rotas inexistentes', () => {
    it('não há DELETE /routine/:id (a ficha não pode ser apagada pela API)', async () => {
      const created = await createRoutine(tokenA);
      const res = await request(http())
        .delete(`/routine/${created.body.id}`)
        .set(auth(tokenA));
      expect(res.status).toBe(404);
      expect((await getRoutine(tokenA, created.body.id)).status).toBe(200);
    });
  });

  describe('comportamento atual (diverge de domain.md)', () => {
    // F4: targetSets 1–20, targetReps 1–100, order ≥ 0. Hoje só exige inteiro.
    it('F4: aceita targetSets, targetReps e order zero ou negativos (201)', async () => {
      const { status, body } = await createRoutine(tokenA, {
        items: [{ exerciseId, order: -1, targetSets: 0, targetReps: -5 }],
      });
      expect(status).toBe(201);
      expect(body.routineItems[0]).toMatchObject({
        order: -1,
        targetSets: 0,
        targetReps: -5,
      });
    });

    // F4: targetSets até 20 e targetReps até 100. Hoje não há teto.
    it('F4: aceita targetSets e targetReps acima do teto (201)', async () => {
      const { status } = await createRoutine(tokenA, {
        items: [item(1, { targetSets: 21, targetReps: 101 })],
      });
      expect(status).toBe(201);
    });

    // F11: order único dentro da ficha. Hoje pode repetir.
    it('F11: aceita order repetido na mesma ficha (201)', async () => {
      const { status, body } = await createRoutine(tokenA, {
        items: [item(1), item(1, { exerciseId: otherExerciseId })],
      });
      expect(status).toBe(201);
      expect(body.routineItems.map((i) => i.order)).toEqual([1, 1]);
    });

    // F10: no máximo 50 itens por ficha e 10 fichas ativas por usuário. Hoje não há limite.
    it('F10: aceita ficha com 51 itens (201)', async () => {
      const items = Array.from({ length: 51 }, (_, i) => item(i + 1));
      const { status, body } = await createRoutine(tokenA, { items });
      expect(status).toBe(201);
      expect(body.routineItems).toHaveLength(51);
    });

    it('F10: aceita mais de 10 fichas ativas para o mesmo usuário', async () => {
      const token = await signUp('limite');
      for (let i = 0; i < 11; i++) {
        const { status } = await createRoutine(token, { name: `Ficha ${i}` });
        expect(status).toBe(201);
      }
      const res = await request(http()).get('/routine').set(auth(token));
      expect((res.body as Routine[]).length).toBe(11);
    });

    // F6: exerciseId inexistente deve dar 400. Hoje a FK do banco recusa e o erro não é tratado.
    it('F6: POST com exerciseId inexistente falha com 500 (FK não tratada)', async () => {
      const { status } = await createRoutine(tokenA, {
        items: [item(1, { exerciseId: randomUUID() })],
      });
      expect(status).toBe(500);
    });

    it('F6: PUT com exerciseId inexistente falha com 500 e a ficha não muda', async () => {
      const created = await createRoutine(tokenA, { items: [item(1)] });
      const res = await request(http())
        .put(`/routine/${created.body.id}`)
        .set(auth(tokenA))
        .send({ items: [item(1, { exerciseId: randomUUID() })] });
      expect(res.status).toBe(500);

      const after = await getRoutine(tokenA, created.body.id);
      expect(after.body.routineItems.map((i) => i.id)).toEqual(
        created.body.routineItems.map((i) => i.id),
      );
    });

    // F6: exercício de outro usuário. Hoje exercício não tem dono (E1), então qualquer um serve.
    it('F6/E1: aceita item com exercício criado por outro usuário (sem dono)', async () => {
      const { status } = await createRoutine(tokenB, { items: [item(1)] });
      expect(status).toBe(201);
    });
  });

  // Não confirmados executando: ficam como hipótese, sem afirmar.
  test.todo(
    'F1 (trade-off 3): hipótese: entre o findOne e a transação do PUT, a escrita filtra só por id; uma corrida poderia alterar ficha de outro usuário. Exige concorrência real para provar',
  );
  test.todo(
    'caso 3: hipótese: dois cadastros simultâneos com o mesmo e-mail dão 500 em vez de 409 (módulo auth, fora deste arquivo)',
  );
});
