# Plano de risco: schema do log de treino e contrato do `POST /sessions`

> Tarefa 2 de `docs/produto.md`. Regras S1, S2, S5, S7, S8, C2, C3; achados A1, A2 (só a coluna), A3, A6, A7 (só log) e A9 de `docs/plans/2026-10-19-auditoria-sessions.md`. A9 estava na tarefa 3 pelo "Resultado" da auditoria; entra aqui porque o DTO já é reescrito. Descartável: o essencial vai para a descrição do PR e este arquivo sai (`git rm`) no mesmo PR.

Aprovado por: Jônatas Júnior em 2026-11-09 (execução adiada a pedido do humano; próximo passo: `use a skill executar-tarefa com o plano docs/plans/2026-11-09-schema-log-treino.md`)
Revisão do plano: APROVADO em 2026-11-09 (2ª rodada; a 1ª pediu AJUSTAR com 9 itens, todos aplicados)

## Decisões do humano (2026-11-09)
- **Reenvio:** o mesmo `id` de sessão enviado de novo pelo mesmo usuário devolve **200 com a sessão já gravada**, sem alterar nada, mesmo com corpo diferente (correção é por outra rota, S9). `id` de sessão de outro usuário → **409**.
- **Campos obrigatórios:** `id` (UUID gerado no aparelho) e `startedAt` são obrigatórios no `POST /sessions`; sem eles, **400**.
- **Formato de `startedAt`:** data, hora e fuso obrigatórios (`2026-11-09T10:00:00Z` ou `2026-11-09T07:00:00-03:00`). Só data, ou hora sem fuso → **400**.
- Viram ADR 0013 (contrato de idempotência por id do cliente, complementa o ADR 0004) e entram em `docs/domain.md` no mesmo PR.

## Ordem das checagens no `POST /sessions`
1. DTO (400). 2. Busca pelo `id`: existe e é do usuário → 200 com a original (sem olhar `routineId` nem `startedAt`); existe e é de outro → 409. 3. Só então a ficha: inexistente ou de outro usuário → 404. 4. Cria (201). Se o `create` falhar com `P2002` (corrida), relê pelo `id` e aplica o passo 2. O tratamento usa `code === 'P2002'`, sem depender de `meta.target`.

## Critérios de aceite
Testes de contrato em `test/sessions-caracterizacao.e2e-spec.ts` (o arquivo **mantém o nome**; mudam blocos e títulos):

- [ ] C1: `{ id: <uuid novo>, routineId: <ficha própria>, startedAt: "2026-11-09T10:00:00.000Z" }` → 201; resposta com chaves exatas `id`, `userId`, `routineId`, `startedAt`, `finishedAt`; `id` e `startedAt` iguais aos enviados; `finishedAt: null`; uma linha no banco — teste: "cria com id e startedAt do aparelho".
- [ ] C2: reenvio do mesmo `id` pelo mesmo usuário → 200 com a sessão original, continua uma linha. Dois casos: (a) `startedAt` diferente; (b) `routineId` de outra ficha própria — teste: "reenvio devolve a original".
- [ ] C3: `id` de sessão de outro usuário → 409, mesmo com `routineId` de ficha alheia; a resposta não contém `userId`, `routineId` nem `startedAt` da sessão alheia; a sessão alheia não muda — teste: "id de outro usuário dá 409".
- [ ] C4: (e2e) dois `POST` simultâneos com o mesmo `id` → respostas só 200 ou 201, nenhum 500, uma linha — teste: "reenvio concorrente não duplica". (unitário, determinístico) com o `create` lançando `P2002`, o service relê e devolve a sessão do mesmo usuário (200) ou lança 409 se for de outro — teste: "P2002 na criação" em `src/sessions/sessions.service.spec.ts`.
- [ ] C5: 400 para: sem `id`; `id: "abc"`; sem `startedAt`; `startedAt: "ontem"`; `startedAt: "2026-11-09"`; `startedAt: "2026-11-09T10:00:00"` (sem fuso). Aceito: `"2026-11-09T07:00:00-03:00"` → 201 e gravado como `2026-11-09T10:00:00.000Z` — teste: "formato de id e startedAt".
- [ ] C6: `startedAt` no futuro (`2030-01-01T00:00:00.000Z`) → 201, gravado como enviado (S1: sem faixa) — teste: "startedAt não tem faixa".
- [ ] C7: continuam valendo, com `id` e `startedAt` válidos no corpo: sem token 401; ficha de outro usuário ou inexistente 404 e nada gravado; `userId` no body 400; `finishedAt` no body 400 (encerrar é a tarefa 3); `DELETE /sessions/:id` 404 — testes: casos "conforme" atuais.

Schema do log (bloco "schema do log" no mesmo arquivo e2e, via Prisma, porque ainda não há rota de série):

- [ ] C8: `SetLog` grava série com `weightKg`, `repsCompleted` e `durationSeconds` vazios; `weightKg = 9999.99` é lido como `9999.99`; `weightKg = 10000` é recusado pelo banco (S5, S7) — teste: "série com campos opcionais e carga Decimal(6,2)".
- [ ] C9: segunda série com o mesmo (`sessionId`, `exerciseId`, `setNumber`) é recusada (`P2002`); mesmo número com outro exercício é aceito (S8) — teste: "número da série único por sessão e exercício".
- [ ] C10: apagar sessão com série, usuário com sessão, ficha com sessão ou exercício com série é recusado (`P2003`) e nada é apagado (C2, C3, invariante 3) — teste: "histórico não sai em cascata".
- [ ] C11: `npx prisma migrate deploy` aplica a migration nova num banco com sessões da migration anterior; elas ficam com `finishedAt` nulo e os demais campos iguais — prova: passos 1 a 4 da "Validação do humano".

Fora de escopo: rotas de série e de encerramento (tarefa 3); uma sessão aberta por usuário e o índice parcial de S3 (tarefa 3); ficha vazia (S4, tarefa 3); endpoint de sincronismo (tarefa 17); serialização de `Decimal` no JSON (não há rota que devolva série); faixa de `durationSeconds`; FKs de `WorkoutRoutine.userId` e `RoutineItem.exerciseId` (tarefa 6, com a migração para `Program`); fluxo de exclusão de conta.

### Testes existentes alterados em `test/sessions-caracterizacao.e2e-spec.ts`
Cada um declarado no commit como `Teste alterado: <motivo abaixo>`.

| Caso de hoje | Vira | Motivo |
|---|---|---|
| "S1: cria a sessão na ficha própria…" (conforme) | C1 | a resposta ganha `finishedAt` e o corpo exige `id` e `startedAt` |
| "S5/ADR 0004 (A1): id gerado no cliente é recusado" (diverge) | C1 (passa a conforme) | A1 corrigido: o `id` do cliente é o contrato |
| "ADR 0004/S3 (A1, A2): reenviar o mesmo body cria duas sessões" (diverge) | C2 (conforme) | A1 corrigido: reenvio não duplica |
| "S1 (A3): startedAt no body dá 400; sem ele, relógio do servidor" (diverge) | C5 e C6 (conforme) | A3 corrigido: `startedAt` vem do aparelho e é obrigatório |
| "S2/S3 (A2): duas sessões seguidas… nenhuma tem finishedAt" (diverge) | continua divergente: duas sessões com `id`s diferentes ficam abertas, com `finishedAt: null` | a coluna existe agora; a regra de uma aberta é da tarefa 3 |
| "S4 (A4)", "S9 (A5)", "F1", "ficha inexistente", "userId no body", "S9 DELETE" | mesma expectativa | só o corpo ganha `id` e `startedAt` válidos |
| `afterAll` | apaga, nesta ordem: séries das sessões dos `userIds` → sessões dos `userIds` → usuários (fichas em cascata) → exercício | FKs do log passam a `Restrict` |

As outras suítes (`auth`, `authguard-caracterizacao`, `exercises-caracterizacao`, `routines*`) não criam sessão nem série e não mudam (conferido pelo revisor de plano).

## Documentação no mesmo PR
- `docs/adr/0013-idempotencia-por-id-do-cliente.md`: as três decisões do humano, a ordem das checagens e a consequência das FKs `Restrict` (apagar ficha ou usuário com sessão falha; exclusão de conta e arquivamento precisam seguir a ordem).
- `docs/domain.md`: S1 (`startedAt` obrigatório com fuso, implementado), S2 (coluna existe), S5 (ids do cliente obrigatórios, reenvio → 200, alheio → 409), S7 (Decimal implementado), S8 (constraint implementada; o 409 da rota é da tarefa 3), C2/C3 (FKs do log implementadas; `WorkoutRoutine.userId` e `RoutineItem.exerciseId` ficam para a tarefa 6), e as linhas S1/S2, S5/S7, S8 e "E6, C2, C3" de "Mudanças de código decorrentes".

## Risco
- **Zona tocada:** `prisma/schema.prisma` e `prisma/migrations/` (migration nova; nenhuma existente é editada); `npx prisma migrate dev`/`deploy` só em banco local ou descartável. Não toca `src/auth/`.
- **O que muda no schema:** `WorkoutSession.finishedAt DateTime?`; `startedAt` sem `@default(now())`; `SetLog.weightKg Decimal(6,2)?`, `repsCompleted Int?`, `durationSeconds Int?`; `@@unique([sessionId, exerciseId, setNumber])`; `onDelete: Restrict` em `WorkoutSession.userId`, `WorkoutSession.routineId`, `SetLog.sessionId` e `SetLog.exerciseId`.
- **Código:** `CreateSessionDto` ganha `id` (`@IsUUID()`) e `startedAt` (ISO 8601 estrito com fuso obrigatório); `routineId` passa a `@IsUUID()` com a mensagem padrão (A9); service com a ordem de checagens acima. Estimativa: menos de 120 linhas de produção.
- **Como desfazer:** reverter o código e o schema **mantendo a pasta da migration desta tarefa**, e criar por cima uma migration nova que: preenche `weight_kg` e `reps_completed` nulos (com 0) e os volta a `NOT NULL`, `weight_kg` para `DOUBLE PRECISION`; volta as 4 FKs para `ON DELETE CASCADE`; remove `finished_at`, `duration_seconds` e a unique; devolve `DEFAULT CURRENT_TIMESTAMP` a `started_at`. A API não está em produção (U8).
- **Pré-mortem:** (1) corrida de dois `POST` com o mesmo id vira 500 → C4 unitário força o `P2002`. (2) a migration falha em banco de dev com séries duplicadas → `set_logs` não tem escrita por rota hoje; o passo 2 da validação mostra. (3) outra suíte e2e quebra pela FK `Restrict` → `npm run test:e2e` inteiro no Postgres descartável. (4) o aparelho manda hora sem fuso → 400 (C5), em vez de gravar hora deslocada. (5) futura rota que apague ficha ou usuário com sessão responde 500 por `P2003` → registrado no ADR 0013; hoje nenhuma rota apaga.
- **Segurança** (skill `seguranca`: entrada externa e autorização): `userId` só do token; o `id` do cliente nunca dá acesso a sessão alheia (C3 confere que a resposta não vaza dados); DTO com `whitelist` e `forbidNonWhitelisted`; o 409 revela que um UUID existe, risco desprezível com UUID aleatório (aceito na auditoria). Sem segredo, sem dependência.
- **Dependências novas:** Nenhuma.

## Validação do humano
1. Na `main`: `git switch main`, `docker compose up -d`, `npx prisma migrate deploy`, `npx prisma generate`, `npm run start:dev`. Cadastre um usuário (`POST /auth/register`), faça login (`POST /auth/login`), crie uma ficha (`POST /routine`) e uma sessão (`POST /sessions` com só `routineId`). Anote `id`, `userId`, `routineId` e `startedAt` da sessão. Pare o app.
2. `git switch feat/schema-log-treino`, `npx prisma migrate deploy` (deve aplicar a migration nova sem erro) e `npx prisma generate`.
3. `npx prisma studio`, tabela `workout_sessions`: a sessão do passo 1 tem os mesmos `id`, `userId`, `routineId` e `startedAt`, e `finishedAt` vazio (C11).
4. `npm run start:dev`, faça login e envie duas vezes `POST /sessions` com `{ "id": "<uuid novo>", "routineId": "<sua ficha>", "startedAt": "2026-11-09T10:00:00Z" }`: 201 e depois 200, com o mesmo `id`.
5. Com outro usuário, envie o mesmo `id`: 409. Com `startedAt: "2026-11-09T10:00:00"` (sem fuso): 400.
