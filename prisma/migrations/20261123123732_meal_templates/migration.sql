-- CreateEnum
CREATE TYPE "MealTemplateKind" AS ENUM ('COMPONENTS');

-- CreateEnum
CREATE TYPE "ComponentTargetType" AS ENUM ('KCAL', 'PROTEIN', 'CARBS', 'WEIGHT');

-- CreateTable
CREATE TABLE "meal_templates" (
    "id" TEXT NOT NULL,
    "meal_slot_id" TEXT NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "order" INTEGER NOT NULL,
    "kind" "MealTemplateKind" NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "meal_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "meal_template_components" (
    "id" TEXT NOT NULL,
    "meal_template_id" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "target_type" "ComponentTargetType" NOT NULL,
    "target_value" DECIMAL(6,1) NOT NULL,

    CONSTRAINT "meal_template_components_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "meal_template_options" (
    "id" TEXT NOT NULL,
    "component_id" TEXT NOT NULL,
    "food_id" TEXT NOT NULL,
    "position" INTEGER NOT NULL,

    CONSTRAINT "meal_template_options_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "meal_templates_meal_slot_id_order_key" ON "meal_templates"("meal_slot_id", "order");

-- CreateIndex
CREATE INDEX "meal_template_components_meal_template_id_idx" ON "meal_template_components"("meal_template_id");

-- CreateIndex
CREATE INDEX "meal_template_options_food_id_idx" ON "meal_template_options"("food_id");

-- CreateIndex
CREATE UNIQUE INDEX "meal_template_options_component_id_food_id_key" ON "meal_template_options"("component_id", "food_id");

-- AddForeignKey
ALTER TABLE "meal_templates" ADD CONSTRAINT "meal_templates_meal_slot_id_fkey" FOREIGN KEY ("meal_slot_id") REFERENCES "meal_slots"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "meal_template_components" ADD CONSTRAINT "meal_template_components_meal_template_id_fkey" FOREIGN KEY ("meal_template_id") REFERENCES "meal_templates"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "meal_template_options" ADD CONSTRAINT "meal_template_options_component_id_fkey" FOREIGN KEY ("component_id") REFERENCES "meal_template_components"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "meal_template_options" ADD CONSTRAINT "meal_template_options_food_id_fkey" FOREIGN KEY ("food_id") REFERENCES "foods"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
