-- CreateTable
CREATE TABLE "food_yields" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "raw_food_id" TEXT NOT NULL,
    "cooked_food_id" TEXT NOT NULL,
    "factor" DECIMAL(6,2) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "food_yields_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "food_yields_raw_food_id_idx" ON "food_yields"("raw_food_id");

-- CreateIndex
CREATE INDEX "food_yields_cooked_food_id_idx" ON "food_yields"("cooked_food_id");

-- CreateIndex
CREATE UNIQUE INDEX "food_yields_user_id_raw_food_id_cooked_food_id_key" ON "food_yields"("user_id", "raw_food_id", "cooked_food_id");

-- AddForeignKey
ALTER TABLE "food_yields" ADD CONSTRAINT "food_yields_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "food_yields" ADD CONSTRAINT "food_yields_raw_food_id_fkey" FOREIGN KEY ("raw_food_id") REFERENCES "foods"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "food_yields" ADD CONSTRAINT "food_yields_cooked_food_id_fkey" FOREIGN KEY ("cooked_food_id") REFERENCES "foods"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
