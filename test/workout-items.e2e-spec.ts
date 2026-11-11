// Tarefa 7b (docs/plans/2026-11-11-item-do-treino.md): campos novos do item do treino e F4.
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { randomUUID } from 'crypto';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import type { Server } from 'http';

type ItemResponse = {
  id: string;
  order: number;
  targetSets: number;
  targetRepsMin: number | null;
  targetRepsMax: number | null;
  targetDurationSeconds: number | null;
  setType: string;
  perSide: boolean;
  restSeconds: number | null;
  supersetGroup: number | null;
  rir: number | null;
  rpe: string | null;
};
type WorkoutResponse = { id: string; items: ItemResponse[] };

describe('Item do treino (campos da tarefa 7b)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let token: string;
  let userId: string;
  let exerciseId: string;

  const http = () => app.getHttpServer() as Server;
  const auth = () => ({ Authorization: `Bearer ${token}` });

  const base = (extra: Record<string, unknown> = {}) => ({
    exerciseId,
    order: 1,
    targetSets: 3,
    targetRepsMin: 8,
    targetRepsMax: 12,
    ...extra,
  });

  const post = (items: Record<string, unknown>[]) =>
    request(http())
      .post('/workouts')
      .set(auth())
      .send({ name: 'Treino 7b', items });

  const put = (id: string, items: Record<string, unknown>[]) =>
    request(http()).put(`/workouts/${id}`).set(auth()).send({ items });

  const getWorkout = async (id: string) => {
    const res = await request(http()).get(`/workouts/${id}`).set(auth());
    expect(res.status).toBe(200);
    return res.body as WorkoutResponse;
  };

  const createOk = async (items: Record<string, unknown>[]) => {
    const res = await post(items);
    expect(res.status).toBe(201);
    return res.body as WorkoutResponse;
  };

  // Cada caso vale no POST e no PUT com items (o PUT parte de um treino válido).
  const expectStatusInPostAndPut = async (
    items: Record<string, unknown>[],
    status: number,
  ) => {
    expect((await post(items)).status).toBe(status);
    const w = await createOk([base()]);
    const res = await put(w.id, items);
    expect(res.status).toBe(status === 201 ? 200 : status);
    return res;
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
    await app.listen(0);
    prisma = app.get(PrismaService);

    const email = `item7b-${randomUUID()}@example.com`;
    const reg = await request(http())
      .post('/auth/register')
      .send({ name: 'Item 7b', email, password: 'password123' })
      .expect(201);
    userId = (reg.body as { id: string }).id;
    const login = await request(http())
      .post('/auth/login')
      .send({ email, password: 'password123' })
      .expect(201);
    token = (login.body as { accessToken: string }).accessToken;
    const ex = await request(http())
      .post('/exercises')
      .set(auth())
      .send({ name: 'Supino 7b', muscleGroup: 'chest' })
      .expect(201);
    exerciseId = (ex.body as { id: string }).id;
  });

  afterAll(async () => {
    // FKs Restrict (C3): treinos (itens em cascata) → exercícios → usuário.
    await prisma.$executeRaw`DELETE FROM workouts WHERE user_id = ${userId}`;
    await prisma.$executeRaw`DELETE FROM exercises WHERE user_id = ${userId}`;
    await prisma.user.deleteMany({ where: { id: userId } });
    await prisma.$disconnect();
    await app.close();
  });

  it('C1: item com todos os campos', async () => {
    const items = [
      base({
        setType: 'DROP',
        perSide: true,
        restSeconds: 90,
        rpe: 8.5,
        targetDurationSeconds: 30,
        supersetGroup: 1,
      }),
      base({ order: 2, supersetGroup: 1, rir: 2, setType: 'FAILURE' }),
    ];
    for (const created of [
      await createOk(items),
      await (async () => {
        const w = await createOk([base()]);
        const res = await put(w.id, items);
        expect(res.status).toBe(200);
        return res.body as WorkoutResponse;
      })(),
    ]) {
      const w = await getWorkout(created.id);
      expect(w.items[0]).toMatchObject({
        order: 1,
        targetSets: 3,
        targetRepsMin: 8,
        targetRepsMax: 12,
        targetDurationSeconds: 30,
        setType: 'DROP',
        perSide: true,
        restSeconds: 90,
        supersetGroup: 1,
        rir: null,
        rpe: '8.5',
      });
      expect(w.items[1]).toMatchObject({
        order: 2,
        setType: 'FAILURE',
        perSide: false,
        supersetGroup: 1,
        rir: 2,
        rpe: null,
      });
    }
  });

  it('C1/R7: RPE inteiro volta sem casa decimal', async () => {
    const created = await createOk([base({ rpe: 8 })]);
    expect((await getWorkout(created.id)).items[0].rpe).toBe('8');
  });

  it('C2: padrões do item', async () => {
    const created = await createOk([base()]);
    expect((await getWorkout(created.id)).items[0]).toMatchObject({
      setType: 'NORMAL',
      perSide: false,
      targetDurationSeconds: null,
      restSeconds: null,
      supersetGroup: null,
      rir: null,
      rpe: null,
    });
  });

  it('C3: item só com duração', async () => {
    const items = [
      { exerciseId, order: 1, targetSets: 3, targetDurationSeconds: 60 },
    ];
    await expectStatusInPostAndPut(items, 201);
    const created = await createOk(items);
    expect((await getWorkout(created.id)).items[0]).toMatchObject({
      targetRepsMin: null,
      targetRepsMax: null,
      targetDurationSeconds: 60,
    });
  });

  describe('C4: limites do item', () => {
    const noReps = { exerciseId, order: 1, targetSets: 3 };
    const cases: [string, () => Record<string, unknown>[]][] = [
      ['targetRepsMin 0', () => [base({ targetRepsMin: 0 })]],
      [
        'targetRepsMin 101',
        () => [base({ targetRepsMin: 101, targetRepsMax: 101 })],
      ],
      ['targetRepsMax 101', () => [base({ targetRepsMax: 101 })]],
      [
        'mínimo maior que o máximo',
        () => [base({ targetRepsMin: 12, targetRepsMax: 8 })],
      ],
      ['só o mínimo (R1)', () => [base({ targetRepsMax: undefined })]],
      ['só o máximo (R1)', () => [base({ targetRepsMin: undefined })]],
      [
        'mínimo null com máximo (R1, R8)',
        () => [base({ targetRepsMin: null })],
      ],
      ['sem repetições e sem duração (R2)', () => [{ ...noReps, exerciseId }]],
      ['targetDurationSeconds 0', () => [base({ targetDurationSeconds: 0 })]],
      [
        'targetDurationSeconds 14401',
        () => [base({ targetDurationSeconds: 14401 })],
      ],
      ['restSeconds -1', () => [base({ restSeconds: -1 })]],
      ['restSeconds 601', () => [base({ restSeconds: 601 })]],
      ['rir -1', () => [base({ rir: -1 })]],
      ['rir 6', () => [base({ rir: 6 })]],
      ['rir 2.5', () => [base({ rir: 2.5 })]],
      ['rpe 0.5', () => [base({ rpe: 0.5 })]],
      ['rpe 10.5', () => [base({ rpe: 10.5 })]],
      ['rpe 8.3', () => [base({ rpe: 8.3 })]],
      ['rir e rpe juntos', () => [base({ rir: 2, rpe: 8 })]],
      ['setType fora dos 4 valores', () => [base({ setType: 'SUPER' })]],
      ['supersetGroup 0', () => [base({ supersetGroup: 0 })]],
      [
        'supersetGroup 51',
        () => [
          base({ supersetGroup: 51 }),
          base({ order: 2, supersetGroup: 51 }),
        ],
      ],
      [
        'grupo de superssérie com 1 item (R4)',
        () => [base({ supersetGroup: 1 }), base({ order: 2 })],
      ],
      ['campo targetReps antigo', () => [base({ targetReps: 10 })]],
      ['setType null (R8)', () => [base({ setType: null })]],
      ['perSide null (R8)', () => [base({ perSide: null })]],
    ];

    it.each(cases)('%s dá 400', async (_name, items) => {
      await expectStatusInPostAndPut(items(), 400);
    });
  });

  describe('C4: bordas aceitas', () => {
    const cases: [string, () => Record<string, unknown>[]][] = [
      ['targetDurationSeconds 1', () => [base({ targetDurationSeconds: 1 })]],
      [
        'targetDurationSeconds 14400',
        () => [base({ targetDurationSeconds: 14400 })],
      ],
      ['restSeconds 0', () => [base({ restSeconds: 0 })]],
      ['restSeconds 600', () => [base({ restSeconds: 600 })]],
      ['rir 0', () => [base({ rir: 0 })]],
      ['rir 5', () => [base({ rir: 5 })]],
      ['rpe 1', () => [base({ rpe: 1 })]],
      ['rpe 9.5', () => [base({ rpe: 9.5 })]],
      ['rpe 10', () => [base({ rpe: 10 })]],
      [
        'supersetGroup 1',
        () => [
          base({ supersetGroup: 1 }),
          base({ order: 2, supersetGroup: 1 }),
        ],
      ],
      [
        'supersetGroup 50',
        () => [
          base({ supersetGroup: 50 }),
          base({ order: 2, supersetGroup: 50 }),
        ],
      ],
      ['setType WARMUP', () => [base({ setType: 'WARMUP' })]],
      [
        'anuláveis com null (R8)',
        () => [
          base({
            targetDurationSeconds: null,
            restSeconds: null,
            supersetGroup: null,
            rir: null,
            rpe: null,
          }),
        ],
      ],
    ];

    it.each(cases)('%s dá 201', async (_name, items) => {
      await expectStatusInPostAndPut(items(), 201);
    });

    it('anuláveis com null voltam null', async () => {
      const created = await createOk([
        base({ restSeconds: null, rir: null, rpe: null }),
      ]);
      expect((await getWorkout(created.id)).items[0]).toMatchObject({
        restSeconds: null,
        rir: null,
        rpe: null,
      });
    });
  });

  describe('C5: F4', () => {
    const cases: [string, () => Record<string, unknown>[], number][] = [
      ['targetSets 0', () => [base({ targetSets: 0 })], 400],
      ['targetSets 21', () => [base({ targetSets: 21 })], 400],
      ['order -1', () => [base({ order: -1 })], 400],
      ['order 2147483648', () => [base({ order: 2147483648 })], 400],
      ['targetSets 1', () => [base({ targetSets: 1 })], 201],
      ['targetSets 20', () => [base({ targetSets: 20 })], 201],
      ['order 0', () => [base({ order: 0 })], 201],
      [
        'repetições 1 a 1',
        () => [base({ targetRepsMin: 1, targetRepsMax: 1 })],
        201,
      ],
      [
        'repetições 100 a 100',
        () => [base({ targetRepsMin: 100, targetRepsMax: 100 })],
        201,
      ],
    ];

    it.each(cases)('%s dá %s', async (_name, items, status) => {
      await expectStatusInPostAndPut(items(), status);
    });
  });

  it('C6: PUT inválido não muda os itens', async () => {
    const created = await createOk([
      base({ restSeconds: 60 }),
      base({ order: 2 }),
    ]);
    const before = await getWorkout(created.id);
    const res = await put(created.id, [base({ rir: 9 })]);
    expect(res.status).toBe(400);
    expect((await getWorkout(created.id)).items).toEqual(before.items);
  });
});
