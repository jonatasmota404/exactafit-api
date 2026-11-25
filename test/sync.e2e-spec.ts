// Tarefa 17a-2: POST /sync com sessões e séries (S3 no lote).
// Critérios C1–C10 do plano docs/plans/2026-11-25-sincronismo.md; as corridas só online
// e o índice (C10 e C11) estão em test/sessions-uma-aberta.e2e-spec.ts (17a-1).
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { randomUUID } from 'crypto';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import type { Server } from 'http';

type User = {
  id: string;
  token: string;
  exerciseId: string;
  workoutId: string; // com itens
  emptyWorkoutId: string; // sem itens
};
type ItemResult = {
  id: string | null;
  status: 'created' | 'existing' | 'closed' | 'error';
  error?: { statusCode: number; message: string | string[] };
};
type SyncResponse = {
  sessions: ItemResult[];
  sets: ItemResult[];
  mealLogs: ItemResult[];
  autoClosedSessionIds: string[];
};

const T = (h: number) =>
  new Date(Date.UTC(2026, 10, 20, h, 0, 0)).toISOString(); // 2026-11-20Thh:00Z

describe('Sincronismo (tarefa 17a)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const userIds: string[] = [];

  const http = () => app.getHttpServer() as Server;
  const auth = (u: User) => ({ Authorization: `Bearer ${u.token}` });

  const signUp = async (): Promise<User> => {
    const email = `sync17-${randomUUID()}@example.com`;
    const reg = await request(http())
      .post('/auth/register')
      .send({ name: 'Sync', email, password: 'password123' })
      .expect(201);
    const id = (reg.body as { id: string }).id;
    userIds.push(id);
    const login = await request(http())
      .post('/auth/login')
      .send({ email, password: 'password123' })
      .expect(201);
    const token = (login.body as { accessToken: string }).accessToken;
    const h = { Authorization: `Bearer ${token}` };
    const ex = await request(http())
      .post('/exercises')
      .set(h)
      .send({
        name: `Supino ${randomUUID().slice(0, 8)}`,
        muscleGroup: 'chest',
      })
      .expect(201);
    const exerciseId = (ex.body as { id: string }).id;
    const w = await request(http())
      .post('/workouts')
      .set(h)
      .send({
        name: 'Treino A',
        items: [
          {
            exerciseId,
            order: 1,
            targetSets: 3,
            targetRepsMin: 10,
            targetRepsMax: 10,
          },
        ],
      })
      .expect(201);
    const empty = await request(http())
      .post('/workouts')
      .set(h)
      .send({ name: 'Rascunho', items: [] })
      .expect(201);
    return {
      id,
      token,
      exerciseId,
      workoutId: (w.body as { id: string }).id,
      emptyWorkoutId: (empty.body as { id: string }).id,
    };
  };

  const sync = (u: User, body: unknown) =>
    request(http())
      .post('/sync')
      .set(auth(u))
      .send(body as object);
  const syncOk = async (u: User, body: unknown) => {
    const res = await sync(u, body);
    expect(res.status).toBe(200);
    return res.body as SyncResponse;
  };

  const session = (
    u: User,
    startedAt: string,
    extra: Record<string, unknown> = {},
  ) => ({ id: randomUUID(), workoutId: u.workoutId, startedAt, ...extra });
  const set = (
    u: User,
    sessionId: string,
    setNumber: number,
    extra: Record<string, unknown> = {},
  ) => ({
    id: randomUUID(),
    sessionId,
    exerciseId: u.exerciseId,
    setNumber,
    ...extra,
  });

  const startOnline = (u: User, id: string, startedAt: string) =>
    request(http())
      .post('/sessions')
      .set(auth(u))
      .send({ id, workoutId: u.workoutId, startedAt });

  const sessionRow = (id: string) =>
    prisma.workoutSession.findUnique({ where: { id: id.toLowerCase() } });
  const openOf = (u: User) =>
    prisma.workoutSession.findMany({
      where: { userId: u.id, finishedAt: null },
    });
  const counts = async (u: User) => ({
    sessions: await prisma.workoutSession.count({ where: { userId: u.id } }),
    sets: await prisma.setLog.count({
      where: { workoutSession: { userId: u.id } },
    }),
  });

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
    // Histórico sem cascade (ADR 0001): séries → sessões → treinos → exercícios → usuários.
    if (userIds.length) {
      await prisma.$executeRawUnsafe(
        `DELETE FROM set_logs WHERE session_id IN
           (SELECT id FROM workout_sessions WHERE user_id = ANY($1::text[]))`,
        userIds,
      );
      for (const table of ['workout_sessions', 'workouts', 'exercises']) {
        await prisma.$executeRawUnsafe(
          `DELETE FROM ${table} WHERE user_id = ANY($1::text[])`,
          userIds,
        );
      }
    }
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    await prisma.$disconnect();
    await app.close();
  });

  describe('C1: corpo do lote', () => {
    it('sem token dá 401', async () => {
      await request(http()).post('/sync').send({}).expect(401);
    });

    it('lote vazio dá 200 com as listas vazias', async () => {
      const u = await signUp();
      expect(await syncOk(u, {})).toEqual({
        sessions: [],
        sets: [],
        mealLogs: [],
        autoClosedSessionIds: [],
      });
    });

    it('campo de topo desconhecido, lista que não é array ou corpo que não é objeto dão 400', async () => {
      const u = await signUp();
      for (const body of [
        { foo: [] },
        { userId: u.id },
        { sessions: {} },
        { sets: 'x' },
        { mealLogs: 1 },
      ]) {
        const res = await sync(u, body);
        expect({ body, status: res.status }).toEqual({ body, status: 400 });
      }
      const arr = await request(http())
        .post('/sync')
        .set(auth(u))
        .set('Content-Type', 'application/json')
        .send('[]');
      expect(arr.status).toBe(400);
    });

    it('corpo acima de 100 KB dá 413 e nada é gravado', async () => {
      const u = await signUp();
      const sessions = Array.from({ length: 1200 }, (_, i) =>
        session(u, T(1), { finishedAt: T(2), pad: 'x'.repeat(i % 2) }),
      );
      const res = await sync(u, { sessions });
      expect(res.status).toBe(413);
      expect((await counts(u)).sessions).toBe(0);
    });
  });

  it('C2: sessão nova com finishedAt nasce encerrada; sem finishedAt, aberta', async () => {
    const u = await signUp();
    const closed = session(u, T(1), { finishedAt: T(2) });
    const open = session(u, T(3));
    const r = await syncOk(u, { sessions: [closed, open] });
    expect(r.sessions).toEqual([
      { id: closed.id, status: 'created' },
      { id: open.id, status: 'created' },
    ]);
    expect(r.autoClosedSessionIds).toEqual([]);
    expect((await sessionRow(closed.id))!.finishedAt!.toISOString()).toBe(T(2));
    expect((await sessionRow(open.id))!.finishedAt).toBeNull();
  });

  it('C3: o mesmo lote enviado duas vezes não duplica nada', async () => {
    const u = await signUp();
    const a = session(u, T(1));
    const b = session(u, T(2));
    const body = {
      sessions: [a, b],
      sets: [set(u, a.id, 1), set(u, b.id, 1), set(u, b.id, 2)],
    };
    const first = await syncOk(u, body);
    expect(first.autoClosedSessionIds).toEqual([a.id]);
    const before = await counts(u);
    expect(before).toEqual({ sessions: 2, sets: 3 });

    const second = await syncOk(u, body);
    expect(second.sessions.map((s) => s.status)).toEqual([
      'existing',
      'existing',
    ]);
    expect(second.sets.map((s) => s.status)).toEqual([
      'existing',
      'existing',
      'existing',
    ]);
    expect(second.autoClosedSessionIds).toEqual([]);
    expect(await counts(u)).toEqual(before);
  });

  describe('C4: sessão que já existe no servidor', () => {
    it('aberta no servidor + finishedAt no lote → closed, startedAt intacto', async () => {
      const u = await signUp();
      const id = randomUUID();
      expect((await startOnline(u, id, T(5))).status).toBe(201);
      const r = await syncOk(u, {
        sessions: [
          {
            id,
            workoutId: u.workoutId,
            startedAt: T(1), // diferente: não muda
            finishedAt: T(6),
          },
        ],
      });
      expect(r.sessions).toEqual([{ id, status: 'closed' }]);
      const row = await sessionRow(id);
      expect(row!.startedAt.toISOString()).toBe(T(5));
      expect(row!.finishedAt!.toISOString()).toBe(T(6));
    });

    it('já encerrada + finishedAt diferente → existing, nada muda', async () => {
      const u = await signUp();
      const s = session(u, T(1), { finishedAt: T(2) });
      await syncOk(u, { sessions: [s] });
      const r = await syncOk(u, { sessions: [{ ...s, finishedAt: T(3) }] });
      expect(r.sessions).toEqual([{ id: s.id, status: 'existing' }]);
      expect((await sessionRow(s.id))!.finishedAt!.toISOString()).toBe(T(2));
    });

    it('aberta + lote sem finishedAt → existing', async () => {
      const u = await signUp();
      const s = session(u, T(1));
      await syncOk(u, { sessions: [s] });
      const r = await syncOk(u, { sessions: [s] });
      expect(r.sessions).toEqual([{ id: s.id, status: 'existing' }]);
      expect((await sessionRow(s.id))!.finishedAt).toBeNull();
    });
  });

  describe('C5: id repetido no mesmo lote', () => {
    it('duas sessões com o mesmo id: a primeira vale, a segunda é existing', async () => {
      const u = await signUp();
      const s = session(u, T(1));
      const r = await syncOk(u, {
        sessions: [s, { ...s, finishedAt: T(2) }],
      });
      expect(r.sessions).toEqual([
        { id: s.id, status: 'created' },
        { id: s.id, status: 'existing' },
      ]);
      expect((await sessionRow(s.id))!.finishedAt).toBeNull();
      expect(r.autoClosedSessionIds).toEqual([]);
    });

    it('duas séries com o mesmo id: created e depois existing', async () => {
      const u = await signUp();
      const s = session(u, T(1));
      const st = set(u, s.id, 1);
      const r = await syncOk(u, { sessions: [s], sets: [st, st] });
      expect(r.sets).toEqual([
        { id: st.id, status: 'created' },
        { id: st.id, status: 'existing' },
      ]);
    });

    it('primeira ocorrência com erro: a repetição traz o mesmo erro', async () => {
      const u = await signUp();
      const bad = { ...session(u, T(1)), workoutId: randomUUID() };
      const r = await syncOk(u, { sessions: [bad, bad] });
      expect(r.sessions[0].status).toBe('error');
      expect(r.sessions[1]).toEqual(r.sessions[0]);
      expect(r.sessions[0].error).toEqual({
        statusCode: 404,
        message: 'Treino não encontrado',
      });
    });

    it('mesmo id em caixas diferentes é repetido, sem 500', async () => {
      const u = await signUp();
      const s = session(u, T(1));
      const r = await syncOk(u, {
        sessions: [s, { ...s, id: s.id.toUpperCase() }],
      });
      expect(r.sessions).toEqual([
        { id: s.id, status: 'created' },
        { id: s.id, status: 'existing' },
      ]);
      expect((await counts(u)).sessions).toBe(1);
    });

    it('item que não é objeto dá erro 400 só nele, com id null', async () => {
      const u = await signUp();
      const s = session(u, T(1), { finishedAt: T(2) });
      const r = await syncOk(u, { sessions: [null, 7, 'x', s] });
      for (const i of [0, 1, 2]) {
        expect(r.sessions[i].id).toBeNull();
        expect(r.sessions[i].status).toBe('error');
        expect(r.sessions[i].error!.statusCode).toBe(400);
      }
      expect(r.sessions[3]).toEqual({ id: s.id, status: 'created' });
    });
  });

  it('C6: duas abertas no lote — fica a mais recente; a outra nasce encerrada com duração zero', async () => {
    const u = await signUp();
    const t1 = session(u, T(1));
    const t2 = session(u, T(2));
    const r = await syncOk(u, { sessions: [t2, t1] });
    expect(r.sessions.map((s) => s.status)).toEqual(['created', 'created']);
    expect(r.autoClosedSessionIds).toEqual([t1.id]);
    expect((await sessionRow(t2.id))!.finishedAt).toBeNull();
    expect((await sessionRow(t1.id))!.finishedAt!.toISOString()).toBe(T(1));
  });

  describe('C7: disputa com a sessão aberta no servidor', () => {
    // Revisão do 17a-2 (rodada 1): a aberta do servidor que o próprio lote encerra (C4, closed)
    // sai da disputa; o finishedAt do lote vale e ela não aparece como encerrada automaticamente.
    it('aberta encerrada pelo lote + nova aberta mais recente: finishedAt do lote vale', async () => {
      const u = await signUp();
      const x = randomUUID();
      expect((await startOnline(u, x, T(5))).status).toBe(201);
      const n = session(u, T(7));
      const r = await syncOk(u, {
        sessions: [
          { id: x, workoutId: u.workoutId, startedAt: T(5), finishedAt: T(6) },
          n,
        ],
      });
      expect(r.sessions).toEqual([
        { id: x, status: 'closed' },
        { id: n.id, status: 'created' },
      ]);
      expect(r.autoClosedSessionIds).toEqual([]);
      expect((await sessionRow(x))!.finishedAt!.toISOString()).toBe(T(6));
      expect((await openOf(u)).map((s) => s.id)).toEqual([n.id]);
    });

    it('aberta encerrada pelo lote + nova aberta mais antiga: a nova fica aberta', async () => {
      const u = await signUp();
      const x = randomUUID();
      expect((await startOnline(u, x, T(9))).status).toBe(201);
      const n = session(u, T(7));
      const r = await syncOk(u, {
        sessions: [
          {
            id: x,
            workoutId: u.workoutId,
            startedAt: T(9),
            finishedAt: T(10),
          },
          n,
        ],
      });
      expect(r.autoClosedSessionIds).toEqual([]);
      expect((await sessionRow(x))!.finishedAt!.toISOString()).toBe(T(10));
      expect((await openOf(u)).map((s) => s.id)).toEqual([n.id]);
    });

    it('a do lote é mais recente: a do servidor é encerrada', async () => {
      const u = await signUp();
      const server = randomUUID();
      expect((await startOnline(u, server, T(1))).status).toBe(201);
      const s = session(u, T(2));
      const r = await syncOk(u, { sessions: [s] });
      expect(r.sessions).toEqual([{ id: s.id, status: 'created' }]);
      expect(r.autoClosedSessionIds).toEqual([server]);
      expect((await sessionRow(server))!.finishedAt!.toISOString()).toBe(T(1));
      expect((await openOf(u)).map((x) => x.id)).toEqual([s.id]);
    });

    it('a do lote é mais antiga: ela nasce encerrada', async () => {
      const u = await signUp();
      const server = randomUUID();
      expect((await startOnline(u, server, T(5))).status).toBe(201);
      const s = session(u, T(2));
      const r = await syncOk(u, { sessions: [s] });
      expect(r.sessions).toEqual([{ id: s.id, status: 'created' }]);
      expect(r.autoClosedSessionIds).toEqual([s.id]);
      expect((await sessionRow(s.id))!.finishedAt!.toISOString()).toBe(T(2));
      expect((await openOf(u)).map((x) => x.id)).toEqual([server]);
    });

    it('empate de startedAt: fica aberta a de maior id', async () => {
      const u = await signUp();
      const [low, high] = [randomUUID(), randomUUID()].sort();
      expect((await startOnline(u, low, T(3))).status).toBe(201);
      const r = await syncOk(u, {
        sessions: [{ id: high, workoutId: u.workoutId, startedAt: T(3) }],
      });
      expect(r.autoClosedSessionIds).toEqual([low]);
      expect((await openOf(u)).map((x) => x.id)).toEqual([high]);

      // O inverso: a do servidor tem o maior id e fica aberta.
      const v = await signUp();
      const [vLow, vHigh] = [randomUUID(), randomUUID()].sort();
      expect((await startOnline(v, vHigh, T(3))).status).toBe(201);
      const r2 = await syncOk(v, {
        sessions: [{ id: vLow, workoutId: v.workoutId, startedAt: T(3) }],
      });
      expect(r2.autoClosedSessionIds).toEqual([vLow]);
      expect((await openOf(v)).map((x) => x.id)).toEqual([vHigh]);
    });

    it('a sessão aberta de outro usuário nunca é encerrada', async () => {
      const u = await signUp();
      const other = await signUp();
      const otherId = randomUUID();
      expect((await startOnline(other, otherId, T(1))).status).toBe(201);
      await syncOk(u, { sessions: [session(u, T(9))] });
      expect((await sessionRow(otherId))!.finishedAt).toBeNull();
    });
  });

  describe('C8: erros de sessão viram item error sem derrubar o lote', () => {
    it('formato, userId, treino alheio ou inexistente e id alheio', async () => {
      const u = await signUp();
      const other = await signUp();
      const otherSession = randomUUID();
      expect((await startOnline(other, otherSession, T(1))).status).toBe(201);

      const good = session(u, T(1), { finishedAt: T(2) });
      const r = await syncOk(u, {
        sessions: [
          { id: 'abc', workoutId: u.workoutId, startedAt: T(1) },
          session(u, T(1), { userId: other.id }),
          session(u, T(1), { finishedAt: '2026-11-20 10:00' }),
          { ...session(u, T(1)), workoutId: other.workoutId },
          { ...session(u, T(1)), workoutId: randomUUID() },
          { id: otherSession, workoutId: u.workoutId, startedAt: T(1) },
          good,
        ],
      });
      const [fmt, userId, finFmt, alheio, inexistente, idAlheio, ok] =
        r.sessions;

      expect(fmt.status).toBe('error');
      expect(fmt.error!.statusCode).toBe(400);
      expect(Array.isArray(fmt.error!.message)).toBe(true);
      expect(userId.error!.statusCode).toBe(400);
      expect(finFmt.error!.statusCode).toBe(400);
      expect(alheio.error).toEqual({
        statusCode: 404,
        message: 'Treino não encontrado',
      });
      expect(inexistente.error).toEqual({
        statusCode: 404,
        message: 'Treino não encontrado',
      });
      expect(idAlheio).toEqual({
        id: otherSession,
        status: 'error',
        error: { statusCode: 409, message: 'Id de sessão já utilizado' },
      });
      expect(ok).toEqual({ id: good.id, status: 'created' });

      // Nada foi gravado para o outro usuário nem mudou na sessão dele.
      expect((await counts(other)).sessions).toBe(1);
      expect((await sessionRow(otherSession))!.finishedAt).toBeNull();
      expect((await counts(u)).sessions).toBe(1);
    });

    it('finishedAt null vale como sessão aberta', async () => {
      const u = await signUp();
      const s = session(u, T(1), { finishedAt: null });
      const r = await syncOk(u, { sessions: [s] });
      expect(r.sessions).toEqual([{ id: s.id, status: 'created' }]);
      expect((await sessionRow(s.id))!.finishedAt).toBeNull();
    });

    it('treino sem itens é aceito no lote (S4)', async () => {
      const u = await signUp();
      const s = { ...session(u, T(1)), workoutId: u.emptyWorkoutId };
      const r = await syncOk(u, { sessions: [s] });
      expect(r.sessions).toEqual([{ id: s.id, status: 'created' }]);
    });
  });

  describe('C9: séries no lote', () => {
    it('criada, reenviada, em sessão do lote e em sessão encerrada automaticamente', async () => {
      const u = await signUp();
      const old = session(u, T(1)); // perde a disputa
      const recent = session(u, T(2));
      const a = set(u, old.id, 1, { weightKg: 40, repsCompleted: 10 });
      const b = set(u, recent.id, 1);
      const r = await syncOk(u, { sessions: [old, recent], sets: [a, b] });
      expect(r.autoClosedSessionIds).toEqual([old.id]);
      expect(r.sets).toEqual([
        { id: a.id, status: 'created' },
        { id: b.id, status: 'created' },
      ]);
      const again = await syncOk(u, { sets: [a] });
      expect(again.sets).toEqual([{ id: a.id, status: 'existing' }]);
    });

    it('erros de série viram item error sem derrubar o lote', async () => {
      const u = await signUp();
      const other = await signUp();
      const s = session(u, T(1), { finishedAt: T(2) });
      const s2 = session(u, T(3), { finishedAt: T(4) });
      const otherSession = session(other, T(1), { finishedAt: T(2) });
      const otherSet = set(other, otherSession.id, 1);
      await syncOk(other, { sessions: [otherSession], sets: [otherSet] });
      const used = set(u, s.id, 9);
      await syncOk(u, { sessions: [s, s2], sets: [used] });

      const good = set(u, s.id, 1);
      const invisibleEx = await request(http())
        .post('/exercises')
        .set(auth(other))
        .send({
          name: `Privado ${randomUUID().slice(0, 8)}`,
          muscleGroup: 'back',
        })
        .expect(201);
      const r = await syncOk(u, {
        sets: [
          good,
          set(u, s.id, 1), // setNumber repetido (S8)
          set(u, randomUUID(), 1), // sessão inexistente
          set(u, otherSession.id, 1), // sessão de outro usuário
          set(u, s.id, 2, {
            exerciseId: (invisibleEx.body as { id: string }).id,
          }),
          { ...otherSet, sessionId: s.id }, // id de série de outro usuário
          { ...used, sessionId: s2.id }, // id já usado em outra sessão do usuário
          set(u, s.id, 0), // formato
          set(u, 'abc', 3), // sessionId não é UUID
        ],
      });
      const [
        ok,
        dupNumber,
        noSession,
        alienSession,
        invisible,
        alienSet,
        otherSessionSet,
        fmt,
        badSessionId,
      ] = r.sets;
      expect(ok).toEqual({ id: good.id, status: 'created' });
      expect(dupNumber.error).toEqual({
        statusCode: 409,
        message: 'Número de série já registrado',
      });
      expect(noSession.error).toEqual({
        statusCode: 404,
        message: 'Sessão não encontrada',
      });
      expect(alienSession.error).toEqual({
        statusCode: 404,
        message: 'Sessão não encontrada',
      });
      expect(invisible.error).toEqual({
        statusCode: 404,
        message: 'Exercício não encontrado',
      });
      expect(alienSet.error).toEqual({
        statusCode: 409,
        message: 'Id de série já utilizado',
      });
      expect(otherSessionSet.error).toEqual({
        statusCode: 409,
        message: 'Id de série já utilizado',
      });
      expect(fmt.error!.statusCode).toBe(400);
      expect(badSessionId.error!.statusCode).toBe(400);
      expect((await counts(u)).sets).toBe(2);
      expect((await counts(other)).sets).toBe(1);
    });
  });

  describe('C10: uma aberta por usuário sob concorrência', () => {
    it('POST /sync simultâneo a POST /sessions: sync 200, online 201 ou 409, uma aberta', async () => {
      for (let i = 0; i < 5; i++) {
        const u = await signUp();
        const [online, batch] = await Promise.all([
          startOnline(u, randomUUID(), T(1)),
          sync(u, { sessions: [session(u, T(2))] }),
        ]);
        expect(batch.status).toBe(200);
        expect([201, 409]).toContain(online.status);
        expect(await openOf(u)).toHaveLength(1);
      }
    });
  });
});
