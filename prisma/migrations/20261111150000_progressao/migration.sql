-- CreateEnum
CREATE TYPE "ProgressionType" AS ENUM ('NONE', 'DOUBLE', 'LINEAR');

-- AlterTable
ALTER TABLE "workout_items" ADD COLUMN "progression_type" "ProgressionType" NOT NULL DEFAULT 'NONE',
ADD COLUMN "progression_step_percent" DECIMAL(3,1);
