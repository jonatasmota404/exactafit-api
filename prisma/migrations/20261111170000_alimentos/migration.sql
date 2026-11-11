-- CreateEnum
CREATE TYPE "FoodState" AS ENUM ('RAW', 'COOKED');

-- CreateEnum
CREATE TYPE "FoodTag" AS ENUM ('GLUTEN_FREE', 'LACTOSE_FREE', 'VEGAN', 'VEGETARIAN');

-- CreateTable
CREATE TABLE "foods" (
    "id" TEXT NOT NULL,
    "user_id" TEXT,
    "name" VARCHAR(100) NOT NULL,
    "state" "FoodState" NOT NULL,
    "kcal" DECIMAL(4,1) NOT NULL,
    "protein_g" DECIMAL(4,1) NOT NULL,
    "carbs_g" DECIMAL(4,1) NOT NULL,
    "fat_g" DECIMAL(4,1) NOT NULL,
    "fiber_g" DECIMAL(4,1),
    "tags" "FoodTag"[] DEFAULT ARRAY[]::"FoodTag"[],
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "foods_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "foods_macros_sum_check" CHECK ("protein_g" + "carbs_g" + "fat_g" + coalesce("fiber_g", 0) <= 100)
);

-- CreateIndex
CREATE INDEX "foods_user_id_idx" ON "foods"("user_id");

-- AddForeignKey
ALTER TABLE "foods" ADD CONSTRAINT "foods_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
