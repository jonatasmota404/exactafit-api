// Tarefa 6 (docs/produto.md): tabelas do programa, ainda sem rota (a API é da tarefa 7).
// Em SQL, para não depender do client do Prisma. Decisão (d) e C3 de docs/domain.md.
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { randomUUID } from 'crypto';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import type { Server } from 'http';

type DayRow = { week: number; day: number; workout_id: string; order: number };

describe('Programa (schema)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const userIds: string[] = [];
  const workoutIds: string[] = [];
  const programIds: string[] = [];

  const http = () => app.getHttpServer() as Server;

  const signUp = async () => {
    const email = `prog-${randomUUID()}@example.com`;
    const reg = await request(http())
      .post('/auth/register')
      .send({ name: 'Programa', email, password: 'password123' })
      .expect(201);
    const id = (reg.body as { id: string }).id;
    userIds.push(id);
    return id;
  };

  const newWorkout = async (userId: string, name: string) => {
    const id = randomUUID();
    await prisma.$executeRaw`INSERT INTO workouts (id, user_id, name, created_at, updated_at)
      VALUES (${id}, ${userId}, ${name}, now(), now())`;
    workoutIds.push(id);
    return id;
  };

  const newWeekly = async (userId: string, weeks: number) => {
    const id = randomUUID();
    await prisma.$executeRaw`INSERT INTO programs (id, user_id, name, cycle_type, cycle_days, weeks, start_date, active, created_at, updated_at)
      VALUES (${id}, ${userId}, 'Semanal', 'WEEKLY', 7, ${weeks}, '2026-11-02', true, now(), now())`;
    programIds.push(id);
    return id;
  };

  const addDay = (
    programId: string,
    week: number,
    day: number,
    workoutId: string,
    order: number,
  ) => prisma.$executeRaw`INSERT INTO program_days (id, program_id, week, day, workout_id, "order", created_at, updated_at)
      VALUES (${randomUUID()}, ${programId}, ${week}, ${day}, ${workoutId}, ${order}, now(), now())`;

  const daysOf = (programId: string) => prisma.$queryRaw<DayRow[]>`
    SELECT week, day, workout_id, "order" FROM program_days
    WHERE program_id = ${programId} ORDER BY week, day, "order"`;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleFixture.createNestApplication();
    await app.init();
    prisma = app.get(PrismaService);
  });

  afterAll(async () => {
    // FKs Restrict (C3): programas (dias em cascata) → treinos → usuários.
    for (const id of programIds) {
      await prisma.$executeRaw`DELETE FROM programs WHERE id = ${id}`;
    }
    for (const id of workoutIds) {
      await prisma.$executeRaw`DELETE FROM workouts WHERE id = ${id}`;
    }
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    await prisma.$disconnect();
    await app.close();
  });

  it('C6: programa semanal com alternância A-B, treino repetido e dois treinos no mesmo dia', async () => {
    const userId = await signUp();
    const a = await newWorkout(userId, 'Treino A');
    const b = await newWorkout(userId, 'Treino B');
    const programId = await newWeekly(userId, 2);

    await addDay(programId, 1, 1, a, 1); // semana 1: segunda A
    await addDay(programId, 1, 3, b, 1); // semana 1: quarta B
    await addDay(programId, 1, 5, a, 1); // semana 1: sexta A ...
    await addDay(programId, 1, 5, b, 2); // ... e B no mesmo dia
    await addDay(programId, 2, 1, b, 1); // semana 2: segunda B
    await addDay(programId, 2, 3, a, 1); // semana 2: quarta A

    const program = await prisma.$queryRaw<
      { cycle_type: string; cycle_days: number; weeks: number }[]
    >`SELECT cycle_type::text AS cycle_type, cycle_days, weeks FROM programs WHERE id = ${programId}`;
    expect(program[0]).toEqual({
      cycle_type: 'WEEKLY',
      cycle_days: 7,
      weeks: 2,
    });

    expect(await daysOf(programId)).toEqual([
      { week: 1, day: 1, workout_id: a, order: 1 },
      { week: 1, day: 3, workout_id: b, order: 1 },
      { week: 1, day: 5, workout_id: a, order: 1 },
      { week: 1, day: 5, workout_id: b, order: 2 },
      { week: 2, day: 1, workout_id: b, order: 1 },
      { week: 2, day: 3, workout_id: a, order: 1 },
    ]);
  });

  it('C7: programa rotativo de 5 dias com posições sem treino', async () => {
    const userId = await signUp();
    const a = await newWorkout(userId, 'Push');
    const b = await newWorkout(userId, 'Pull');
    const programId = randomUUID();
    await prisma.$executeRaw`INSERT INTO programs (id, user_id, name, cycle_type, cycle_days, weeks, start_date, active, created_at, updated_at)
      VALUES (${programId}, ${userId}, 'Rotativo', 'ROTATING', 5, 1, '2026-11-02', false, now(), now())`;
    programIds.push(programId);

    await addDay(programId, 1, 1, a, 1);
    await addDay(programId, 1, 2, b, 1);
    await addDay(programId, 1, 4, a, 1);

    const days = await daysOf(programId);
    expect(days.map((d) => d.day)).toEqual([1, 2, 4]);
  });

  it('C8: treino em dia de programa e dono de programa não saem; apagar o programa leva os dias', async () => {
    const userId = await signUp();
    const a = await newWorkout(userId, 'Treino A');
    const programId = await newWeekly(userId, 1);
    await addDay(programId, 1, 1, a, 1);

    await expect(
      prisma.$executeRaw`DELETE FROM workouts WHERE id = ${a}`,
    ).rejects.toThrow(/foreign key|23503/);
    await expect(
      prisma.user.delete({ where: { id: userId } }),
    ).rejects.toMatchObject({ code: 'P2003' });

    await prisma.$executeRaw`DELETE FROM programs WHERE id = ${programId}`;
    expect(await daysOf(programId)).toEqual([]);
    const left = await prisma.$queryRaw<{ n: bigint }[]>`
      SELECT count(*) AS n FROM workouts WHERE id = ${a}`;
    expect(Number(left[0].n)).toBe(1);
  });
});
