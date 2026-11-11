-- Tarefa 6 (ADR 0014): a ficha vira treino e o programa organiza os treinos.
-- Escrita à mão: o SQL gerado pelo Prisma recriaria as tabelas (perda de dados); aqui só há RENAME.

-- Ficha → treino (tabelas, colunas e constraints renomeadas, sem cópia de dados)
ALTER TABLE "workout_routines" RENAME TO "workouts";
ALTER TABLE "workouts" RENAME CONSTRAINT "workout_routines_pkey" TO "workouts_pkey";

ALTER TABLE "routine_items" RENAME TO "workout_items";
ALTER TABLE "workout_items" RENAME CONSTRAINT "routine_items_pkey" TO "workout_items_pkey";
ALTER TABLE "workout_items" RENAME COLUMN "routine_id" TO "workout_id";
ALTER TABLE "workout_items" RENAME CONSTRAINT "routine_items_routine_id_fkey" TO "workout_items_workout_id_fkey";

ALTER TABLE "workout_sessions" RENAME COLUMN "routine_id" TO "workout_id";
ALTER TABLE "workout_sessions" RENAME CONSTRAINT "workout_sessions_routine_id_fkey" TO "workout_sessions_workout_id_fkey";

-- C3: as duas FKs que ainda apagavam em cascata passam a RESTRICT (a constraint é recriada; nenhum dado muda)
ALTER TABLE "workouts" DROP CONSTRAINT "workout_routines_user_id_fkey";
ALTER TABLE "workouts" ADD CONSTRAINT "workouts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "workout_items" DROP CONSTRAINT "routine_items_exercise_id_fkey";
ALTER TABLE "workout_items" ADD CONSTRAINT "workout_items_exercise_id_fkey" FOREIGN KEY ("exercise_id") REFERENCES "exercises"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Programa
CREATE TYPE "CycleType" AS ENUM ('WEEKLY', 'ROTATING');

CREATE TABLE "programs" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "cycle_type" "CycleType" NOT NULL,
    "cycle_days" INTEGER NOT NULL,
    "weeks" INTEGER NOT NULL DEFAULT 1,
    "start_date" DATE NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "programs_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "program_days" (
    "id" TEXT NOT NULL,
    "program_id" TEXT NOT NULL,
    "week" INTEGER NOT NULL,
    "day" INTEGER NOT NULL,
    "workout_id" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "program_days_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "programs" ADD CONSTRAINT "programs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "program_days" ADD CONSTRAINT "program_days_program_id_fkey" FOREIGN KEY ("program_id") REFERENCES "programs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "program_days" ADD CONSTRAINT "program_days_workout_id_fkey" FOREIGN KEY ("workout_id") REFERENCES "workouts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
