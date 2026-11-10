-- DropForeignKey
ALTER TABLE "set_logs" DROP CONSTRAINT "set_logs_exercise_id_fkey";

-- DropForeignKey
ALTER TABLE "set_logs" DROP CONSTRAINT "set_logs_session_id_fkey";

-- DropForeignKey
ALTER TABLE "workout_sessions" DROP CONSTRAINT "workout_sessions_routine_id_fkey";

-- DropForeignKey
ALTER TABLE "workout_sessions" DROP CONSTRAINT "workout_sessions_user_id_fkey";

-- AlterTable
ALTER TABLE "set_logs" ADD COLUMN     "duration_seconds" INTEGER,
ALTER COLUMN "weight_kg" DROP NOT NULL,
ALTER COLUMN "weight_kg" SET DATA TYPE DECIMAL(6,2),
ALTER COLUMN "reps_completed" DROP NOT NULL;

-- AlterTable
ALTER TABLE "workout_sessions" ADD COLUMN     "finished_at" TIMESTAMP(3),
ALTER COLUMN "started_at" DROP DEFAULT;

-- CreateIndex
CREATE UNIQUE INDEX "set_logs_session_id_exercise_id_set_number_key" ON "set_logs"("session_id", "exercise_id", "set_number");

-- AddForeignKey
ALTER TABLE "workout_sessions" ADD CONSTRAINT "workout_sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workout_sessions" ADD CONSTRAINT "workout_sessions_routine_id_fkey" FOREIGN KEY ("routine_id") REFERENCES "workout_routines"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "set_logs" ADD CONSTRAINT "set_logs_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "workout_sessions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "set_logs" ADD CONSTRAINT "set_logs_exercise_id_fkey" FOREIGN KEY ("exercise_id") REFERENCES "exercises"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
