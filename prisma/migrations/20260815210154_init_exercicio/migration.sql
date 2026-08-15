-- CreateTable
CREATE TABLE "exercicios" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "muscle_group" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'strength',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "exercicios_pkey" PRIMARY KEY ("id")
);
