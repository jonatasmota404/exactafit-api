-- AlterEnum
ALTER TYPE "MealTemplateKind" ADD VALUE 'FREE';

-- CreateTable
CREATE TABLE "meal_template_items" (
    "id" TEXT NOT NULL,
    "meal_template_id" TEXT NOT NULL,
    "food_id" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "grams" DECIMAL(6,1) NOT NULL,

    CONSTRAINT "meal_template_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "meal_template_items_food_id_idx" ON "meal_template_items"("food_id");

-- CreateIndex
CREATE UNIQUE INDEX "meal_template_items_meal_template_id_food_id_key" ON "meal_template_items"("meal_template_id", "food_id");

-- AddForeignKey
ALTER TABLE "meal_template_items" ADD CONSTRAINT "meal_template_items_meal_template_id_fkey" FOREIGN KEY ("meal_template_id") REFERENCES "meal_templates"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "meal_template_items" ADD CONSTRAINT "meal_template_items_food_id_fkey" FOREIGN KEY ("food_id") REFERENCES "foods"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
