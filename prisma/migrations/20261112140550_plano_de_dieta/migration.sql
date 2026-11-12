-- CreateTable
CREATE TABLE "diet_plans" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "diet_plans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "meal_slots" (
    "id" TEXT NOT NULL,
    "diet_plan_id" TEXT NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "order" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "meal_slots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "day_types" (
    "id" TEXT NOT NULL,
    "diet_plan_id" TEXT NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "order" INTEGER NOT NULL,
    "training_day" BOOLEAN NOT NULL DEFAULT false,
    "rest_day" BOOLEAN NOT NULL DEFAULT false,
    "kcal" DECIMAL(6,1),
    "protein_g" DECIMAL(6,1),
    "carbs_g" DECIMAL(6,1),
    "fat_g" DECIMAL(6,1),
    "fiber_g" DECIMAL(6,1),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "day_types_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "meal_targets" (
    "id" TEXT NOT NULL,
    "day_type_id" TEXT NOT NULL,
    "meal_slot_id" TEXT NOT NULL,
    "kcal" DECIMAL(6,1),
    "protein_g" DECIMAL(6,1),
    "carbs_g" DECIMAL(6,1),
    "fat_g" DECIMAL(6,1),
    "fiber_g" DECIMAL(6,1),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "meal_targets_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "meal_targets_day_type_id_meal_slot_id_key" ON "meal_targets"("day_type_id", "meal_slot_id");

-- AddForeignKey
ALTER TABLE "diet_plans" ADD CONSTRAINT "diet_plans_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "meal_slots" ADD CONSTRAINT "meal_slots_diet_plan_id_fkey" FOREIGN KEY ("diet_plan_id") REFERENCES "diet_plans"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "day_types" ADD CONSTRAINT "day_types_diet_plan_id_fkey" FOREIGN KEY ("diet_plan_id") REFERENCES "diet_plans"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "meal_targets" ADD CONSTRAINT "meal_targets_day_type_id_fkey" FOREIGN KEY ("day_type_id") REFERENCES "day_types"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "meal_targets" ADD CONSTRAINT "meal_targets_meal_slot_id_fkey" FOREIGN KEY ("meal_slot_id") REFERENCES "meal_slots"("id") ON DELETE CASCADE ON UPDATE CASCADE;
