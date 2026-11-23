-- CreateTable
CREATE TABLE "meal_logs" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "eaten_at" TIMESTAMP(3) NOT NULL,
    "meal_slot_id" TEXT,
    "meal_slot_name" VARCHAR(100),
    "meal_template_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "meal_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "meal_log_items" (
    "id" TEXT NOT NULL,
    "meal_log_id" TEXT NOT NULL,
    "food_id" TEXT,
    "position" INTEGER NOT NULL,
    "food_name" VARCHAR(100) NOT NULL,
    "food_state" "FoodState" NOT NULL,
    "grams" DECIMAL(6,1) NOT NULL,
    "kcal" DECIMAL(8,1) NOT NULL,
    "protein_g" DECIMAL(8,1) NOT NULL,
    "carbs_g" DECIMAL(8,1) NOT NULL,
    "fat_g" DECIMAL(8,1) NOT NULL,
    "fiber_g" DECIMAL(8,1),

    CONSTRAINT "meal_log_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "meal_logs_user_id_eaten_at_idx" ON "meal_logs"("user_id", "eaten_at");

-- CreateIndex
CREATE INDEX "meal_log_items_meal_log_id_idx" ON "meal_log_items"("meal_log_id");

-- CreateIndex
CREATE INDEX "meal_log_items_food_id_idx" ON "meal_log_items"("food_id");

-- AddForeignKey
ALTER TABLE "meal_logs" ADD CONSTRAINT "meal_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "meal_logs" ADD CONSTRAINT "meal_logs_meal_slot_id_fkey" FOREIGN KEY ("meal_slot_id") REFERENCES "meal_slots"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "meal_logs" ADD CONSTRAINT "meal_logs_meal_template_id_fkey" FOREIGN KEY ("meal_template_id") REFERENCES "meal_templates"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "meal_log_items" ADD CONSTRAINT "meal_log_items_meal_log_id_fkey" FOREIGN KEY ("meal_log_id") REFERENCES "meal_logs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "meal_log_items" ADD CONSTRAINT "meal_log_items_food_id_fkey" FOREIGN KEY ("food_id") REFERENCES "foods"("id") ON DELETE SET NULL ON UPDATE CASCADE;
