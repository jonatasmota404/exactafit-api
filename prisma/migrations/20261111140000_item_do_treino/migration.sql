-- CreateEnum
CREATE TYPE "SetType" AS ENUM ('NORMAL', 'WARMUP', 'FAILURE', 'DROP');

-- AlterTable
ALTER TABLE "workout_items"
ADD COLUMN "set_type" "SetType" NOT NULL DEFAULT 'NORMAL',
ADD COLUMN "target_reps_max" INTEGER;

ALTER TABLE "workout_items" RENAME COLUMN "target_reps" TO "target_reps_min";
ALTER TABLE "workout_items" ALTER COLUMN "target_reps_min" DROP NOT NULL;

-- Itens existentes: faixa fixa (mínimo = máximo)
UPDATE "workout_items" SET "target_reps_max" = "target_reps_min";

ALTER TABLE "workout_items"
ADD COLUMN "target_duration_seconds" INTEGER,
ADD COLUMN "per_side" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "rest_seconds" INTEGER,
ADD COLUMN "superset_group" INTEGER,
ADD COLUMN "rir" INTEGER,
ADD COLUMN "rpe" DECIMAL(3,1);
