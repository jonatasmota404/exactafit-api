-- S3: uma sessão aberta por usuário. Transação explícita: se algo falha, o UPDATE não fica aplicado.
BEGIN;

-- Bloqueia escritas concorrentes enquanto encerra as excedentes e cria o índice.
LOCK TABLE "workout_sessions" IN SHARE ROW EXCLUSIVE MODE;

-- Fica aberta a de started_at mais recente (empate: maior id); as demais encerram com duração zero.
UPDATE "workout_sessions" w
SET "finished_at" = w."started_at"
FROM (
  SELECT "id", row_number() OVER (PARTITION BY "user_id" ORDER BY "started_at" DESC, "id" DESC) AS n
  FROM "workout_sessions"
  WHERE "finished_at" IS NULL
) s
WHERE w."id" = s."id" AND s.n > 1;

-- CreateIndex
CREATE UNIQUE INDEX "workout_sessions_one_open_per_user" ON "workout_sessions"("user_id") WHERE (finished_at IS NULL);

COMMIT;
