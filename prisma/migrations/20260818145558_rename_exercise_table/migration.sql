/*
  Warnings:

  - You are about to drop the `exercicios` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropTable
DROP TABLE "exercicios";

-- CreateTable
CREATE TABLE "exercices" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "muscle_group" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'strength',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "exercices_pkey" PRIMARY KEY ("id")
);
