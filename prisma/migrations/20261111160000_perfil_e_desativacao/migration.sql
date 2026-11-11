-- CreateEnum
CREATE TYPE "Sex" AS ENUM ('F', 'M');

-- AlterTable
ALTER TABLE "users" ADD COLUMN "sex" "Sex",
ADD COLUMN "birth_date" DATE,
ADD COLUMN "height_cm" INTEGER,
ADD COLUMN "timezone" VARCHAR(64) NOT NULL DEFAULT 'America/Sao_Paulo',
ADD COLUMN "deactivated_at" TIMESTAMP(3);
