# Plano de risco: campos novos do item do treino (tarefa 7b)

> Tarefa 7b de `docs/produto.md`: o item do treino passa a ter tipo de série, faixa de repetições, tempo, por lado, descanso, superssérie e RIR ou RPE, com migration. A tarefa também aplica F4 (limites de `targetSets`, `order` e repetições), porque é o mesmo DTO e o mesmo campo.

Aprovado por: humano em 2026-11-11 (inclui as regras R1 a R8)
Revisão do plano: AJUSTAR na 2ª rodada, com 1 pendência (ordem da validação do humano) já aplicada; aceita pelo humano em 2026-11-11

## Decisões do humano (2026-11-11, nesta conversa)
- **Tipo de série no item inteiro:** `NORMAL`, `WARMUP` (aquecimento), `FAILURE` (até a falha) ou `DROP`. Aquecimento e séries de trabalho do mesmo exercício viram dois itens (F5 já permite).
- **Faixa de repetições:** `targetReps` vira `targetRepsMin` e `targetRepsMax`, de 1 a 100, com mínimo ≤ máximo; valores iguais significam número fixo. Os itens existentes recebem mínimo = máximo = valor atual.
- **Tempos:**
  - duração-alvo (`targetDurationSeconds`) de 1 s a 4 h (14.400 s); isso fecha o `TODO(humano)` de F4;
  - descanso (`restSeconds`) de 0 a 10 min (600 s).
- **Intensidade:** RIR (0 a 5, inteiro) **ou** RPE (1 a 10, passo de 0,5), opcional. Mandar os dois dá 400.

## Regras de negócio propostas pelo agente (o humano aprova junto com o plano; entram em F4 e na decisão (d) de `docs/domain.md`)
- **R1. Repetições:** `targetRepsMin` e `targetRepsMax` vêm juntos ou nenhum dos dois. Só um deles dá 400.
- **R2. Pelo menos um alvo:** repetições ou duração (F4, decidido por delegação). Os dois juntos são permitidos (ex.: "10 repetições, segurando 3 s" vira faixa e duração).
- **R3. Por lado** (`perSide`): booleano, padrão `false`. Indica que as repetições ou o tempo valem para cada lado (unilateral).
- **R4. Superssérie** (`supersetGroup`): inteiro opcional de 1 a 50.
  - Itens do mesmo treino com o mesmo número formam uma superssérie, feita em sequência na ordem de `order`.
  - Um grupo com um item só dá 400 ("Superssérie precisa de pelo menos 2 itens").
- **R5. F4** (já decidido, implementado aqui): `targetSets` de 1 a 20 e `order` ≥ 0 (até o int4).
- **R6. Tipo de série:** não há regra cruzada entre os campos. Exemplo: `FAILURE` com RIR 2 é aceito; o app interpreta.
- **R7. RPE na resposta:** volta como texto decimal, como `weightKg` na série (Decimal do Prisma). Exemplos: `8.5` volta `"8.5"`; `8` volta `"8"`, e não `"8.0"`.
- **R8. `null` nos campos do item:**
  - em `setType` e `perSide`, que não aceitam nulo no banco, dá 400;
  - nos opcionais anuláveis (`targetRepsMin`/`Max`, `targetDurationSeconds`, `restSeconds`, `supersetGroup`, `rir` e `rpe`), equivale a não mandar o campo e grava `null`. R1 e R2 continuam valendo: `targetRepsMin: null` com `targetRepsMax: 10` dá 400.

## Decisões técnicas do agente (para o revisor conferir)
- **Migration escrita à mão, sem perda de dado:**
  - `CREATE TYPE "SetType"`;
  - na tabela `workout_items`:
    - `ADD COLUMN set_type` (padrão `NORMAL`);
    - `RENAME COLUMN target_reps TO target_reps_min` e `ALTER ... DROP NOT NULL`;
    - `ADD COLUMN target_reps_max`, preenchida com `UPDATE ... SET target_reps_max = target_reps_min`;
    - `ADD COLUMN` para `target_duration_seconds`, `per_side` (padrão `false`), `rest_seconds`, `superset_group`, `rir` e `rpe` `DECIMAL(3,1)`.

  O SQL precisa bater com o schema:
  - `"SetType" NOT NULL DEFAULT 'NORMAL'`;
  - `BOOLEAN NOT NULL DEFAULT false`;
  - `DECIMAL(3,1)`;
  - o resto, `INTEGER` anulável.

  No schema:
  - `setType SetType @default(NORMAL) @map("set_type")`;
  - `targetRepsMin Int? @map("target_reps_min")` e `targetRepsMax Int? @map("target_reps_max")`;
  - `targetDurationSeconds Int?`, `restSeconds Int?`, `supersetGroup Int?` e `rir Int?`, com `@map` em snake_case;
  - `perSide Boolean @default(false) @map("per_side")`;
  - `rpe Decimal? @db.Decimal(3,1)`.

  Conferência, depois do `migrate deploy`: `npx prisma migrate diff --from-config-datasource --to-schema prisma/schema.prisma --exit-code`, com exit 0 esperado.
- **Onde fica o passo 0,5 do RPE:**
  - no DTO: `@IsNumber()`, `@Min(1)` e `@Max(10)`;
  - no service: `Number.isInteger(rpe * 2)`, senão 400;
  - sem `@IsDivisibleBy(0.5)`, que no validator.js faz `% parseInt(0.5)`, ou seja `% 0`, e recusa todo valor.
- **`null` (R8):** `setType` e `perSide` usam `@ValidateIf((_, v) => v !== undefined)`, como o `name` do `UpdateWorkoutDto`. Os anuláveis usam `@IsOptional()`.
- **Teto do int4:** todo inteiro novo tem `@Max` de negócio, que fica abaixo do int4. `order` e `targetSets` também ganham `@Max` (`INT4_MAX` e 20).
- **O contrato muda:** `targetReps` deixa de existir. Quem mandar `targetReps` recebe 400 (`forbidNonWhitelisted`).
- **Testes alterados** (declarados no commit com `Teste alterado:`):
  - **Só o payload muda:** os testes que mandam `targetReps` passam a mandar `targetRepsMin`/`targetRepsMax`. Estão em `test/workouts.e2e-spec.ts`, `test/workouts-caracterizacao.e2e-spec.ts`, `test/sessions.e2e-spec.ts`, `test/sessions-caracterizacao.e2e-spec.ts` e `test/programs.e2e-spec.ts`. Os tipos `Item`/`ItemInput` dos dois arquivos de workouts também mudam.
  - **Muda a asserção, com o mesmo propósito:**
    - `workouts-caracterizacao`, "400 com order, targetSets ou targetReps não inteiros": o laço de campos passa a `order`, `targetSets`, `targetRepsMin` e `targetRepsMax`;
    - `workouts-caracterizacao`, "com items, substitui todos os itens… (F8)": `items[0].targetReps` passa a `targetRepsMin`/`targetRepsMax`;
    - `workouts.e2e-spec.ts`, "PUT /workouts:id -> deve dar update na rotina": mesma troca de campo.
  - **Muda o SQL puro:** `workouts-caracterizacao`, "C5: exercício que está em item de treino não sai em cascata", tem um `INSERT INTO workout_items` que passa de `target_reps` para `target_reps_min, target_reps_max`. O typecheck não pega isso.
  - **Saem dois testes:** em `workouts-caracterizacao`, os dois de "comportamento atual" de F4 ("aceita zero ou negativos" e "aceita acima do teto"). O critério C5 abaixo os substitui e trava o comportamento decidido.
- **Validação cruzada** (R1, R2, R4 e RIR/RPE): no service, com `BadRequestException`. Os limites de cada campo ficam no DTO.

## Critérios de aceite
Arquivo: `test/workout-items.e2e-spec.ts` (novo), salvo onde indicado. Cada caso vale no `POST /workouts` e no `PUT /workouts/:id` com `items`.

- [ ] **C1: item completo.**
  - **Entrada:** um item com todos os campos (`setType: "DROP"`, faixa 8–12, `perSide: true`, `restSeconds: 90`, `rpe: 8.5`) e dois itens com `supersetGroup: 1`.
  - **Esperado:** 201, e o `GET /workouts/:id` devolve os mesmos valores, com `rpe: "8.5"`.

  — teste: "item com todos os campos".
- [ ] **C2: padrões.** Um item só com `exerciseId`, `order`, `targetSets` e faixa volta com `setType: "NORMAL"` e `perSide: false`. `targetDurationSeconds`, `restSeconds`, `supersetGroup`, `rir` e `rpe` voltam `null`. — teste: "padrões do item".
- [ ] **C3: item por tempo.** Um item só com `targetDurationSeconds: 60` (sem repetições) dá 201, com `targetRepsMin` e `targetRepsMax` `null`. — teste: "item só com duração".
- [ ] **C4: limites dão 400.** Um caso para cada:
  - repetições: `targetRepsMin` 0 ou 101; `targetRepsMax` 101; mínimo > máximo; só um dos dois (R1);
  - alvo: sem repetições e sem duração (R2);
  - duração: `targetDurationSeconds` 0 ou 14.401;
  - descanso: `restSeconds` -1 ou 601;
  - intensidade: `rir` -1, 6 ou 2.5; `rpe` 0.5, 10.5 ou 8.3; `rir` e `rpe` juntos;
  - tipo de série: `setType` fora dos 4 valores;
  - superssérie: `supersetGroup` 0 ou 51, ou grupo com 1 item só (R4);
  - campo `targetReps` (antigo);
  - `setType: null` e `perSide: null` (R8).

  Bordas que dão 201:
  - `targetDurationSeconds` 1 e 14.400;
  - `restSeconds` 0 e 600;
  - `rir` 0 e 5;
  - `rpe` 1, 9.5 e 10;
  - `supersetGroup` 1 e 50.

  Os anuláveis com `null` também dão 201 e voltam `null` (R8).

  — teste: "limites do item" (`it.each` de 400) e "bordas aceitas" (`it.each` de 201).
- [ ] **C5: F4 em séries e ordem.** `targetSets` 0 ou 21, `order` -1 e `order` 2147483648 dão 400. Os limites `targetSets` 1 e 20, `order` 0 e repetições 1 e 100 dão 201. — teste: "F4" em `test/workout-items.e2e-spec.ts`. Ele substitui os dois testes de "comportamento atual" de F4 em `workouts-caracterizacao`.
- [ ] **C6: nada é gravado no erro.** Um `PUT` com item inválido dá 400, e os itens do treino continuam iguais no `GET`. — teste: "PUT inválido não muda os itens".
- [ ] **C7: dados existentes preservados pela migration.** Item criado antes da migration com `target_reps = 10`. — verificado por comando, como o C3 da tarefa 6:
  1. Uma semente em SQL na `main`, antes da migration.
  2. `npx prisma migrate deploy`.
  3. A consulta mostra `target_reps_min = 10`, `target_reps_max = 10`, `set_type = NORMAL` e `per_side = false`.
  4. As contagens de `workout_items` são iguais antes e depois.
  5. `npx prisma migrate diff --from-config-datasource --to-schema prisma/schema.prisma --exit-code` dá exit 0.

  As saídas vão no PR.

Fora de escopo:
- tipo de série na série registrada (`SetLog`);
- detalhes do drop (quantas quedas e quanto de carga);
- progressão (tarefa 8);
- `order` único no treino (F11);
- arquivar treino e limites de quantidade (F9 e F10);
- byte nulo em `name` de `/workouts` (pendência transversal).

## Risco
- **Zona tocada:**
  - `prisma/schema.prisma`;
  - `prisma/migrations/<nova>`.

  Também mudam:
  - `src/workouts/`: o DTO e o service;
  - os testes listados acima;
  - `docs/domain.md`: F4 (a linha 154, que fecha o `TODO(humano)` da faixa da duração), a linha 246 da tabela de implementação, a decisão (d) e as regras R1 a R8;
  - `docs/adr/0006`: nota "Alterado pela tarefa 7b", porque `targetReps` virou faixa e a faixa da duração foi decidida; é o mesmo formato de nota que a tarefa 6 usou no ADR 0011;
  - `docs/produto.md`: tarefa 7b feita.
- **Como desfazer:**
  - **antes do merge:** fechar o PR;
  - **depois do merge:** um PR novo que reverte `src/`, o schema e os testes e acrescenta uma migration inversa, nesta ordem:
    1. `UPDATE workout_items SET target_reps_min = COALESCE(target_reps_min, 1);`
    2. `ALTER TABLE workout_items RENAME COLUMN target_reps_min TO target_reps;` e `ALTER ... SET NOT NULL;`
    3. Remover as colunas `target_reps_max`, `target_duration_seconds`, `per_side`, `rest_seconds`, `superset_group`, `rir`, `rpe` e `set_type`.
    4. Só depois remover o tipo `"SetType"`.

  **O que se perde ao desfazer:**
  - o máximo da faixa (um item 8–12 volta como 8 fixo);
  - a duração-alvo (um item só de tempo volta com `target_reps = 1`);
  - o tipo de série, por lado, descanso, superssérie, RIR e RPE.

  Não usar `git revert` da migration.
- **Pré-mortem:**
  1. A migration recria a tabela e perde os itens, se o SQL gerado pelo Prisma for aceito. Mitigação: SQL escrito à mão, só com ADD/RENAME/ALTER, mais o C7.
  2. O front ou um cliente antigo manda `targetReps` e passa a receber 400. Mitigação: ainda não existe front, e a mudança está declarada no PR.
  3. RPE com erro de ponto flutuante (8.3 aceito como 8.5, ou o contrário). Mitigação: validar com `value * 2` inteiro, mais o C4.
  4. Superssérie com grupo de um item só, que confunde o app. Mitigação: R4 e o C4.
- **Segurança** (skill `seguranca`, API):
  - **Validação de entrada:** se aplica (campos numéricos novos). Verificação:
    - DTO com `@Min`/`@Max` e teto no int4 em todo inteiro;
    - C4 e C5;
    - o revisor e o testador procuram 500.
  - **Controle de acesso:** não muda; F1 e F6 continuam cobertos pelos testes existentes.
  - **Autenticação, dados pessoais, segredos e dependências:** não se aplicam.
- **Dependências novas:** Nenhuma.

## Validação do humano
**0. Primeiro, a migration preserva um dado criado antes dela** (faça antes de tudo, porque depois do `migrate deploy` a `main` não roda mais nesse banco):
   1. Na `main`, com o app no ar, crie um treino pelo `POST /workouts` com um item de `"targetReps":10`. Anote o id.
   2. Pare o app, faça o checkout da branch, rode `npx prisma migrate deploy` e suba o app de novo.
   3. **Requisição:** `GET /workouts/<id>`.
   4. **Esperado:** o item com `targetRepsMin: 10`, `targetRepsMax: 10`, `setType: "NORMAL"` e `perSide: false`.

   As saídas do C7 também estão no PR.

Depois, na branch, com o app no ar (`docker compose up -d`, `npx prisma migrate deploy`, `npm run start:dev`), um token e o id de um exercício:

1. Crie um treino com superssérie e RPE:
   - **Requisição:** `POST /workouts` com `{"name":"Treino A","items":[{"exerciseId":"<id>","order":1,"targetSets":3,"targetRepsMin":8,"targetRepsMax":12,"supersetGroup":1,"rpe":8.5,"restSeconds":90},{"exerciseId":"<id>","order":2,"targetSets":3,"targetRepsMin":10,"targetRepsMax":10,"supersetGroup":1,"perSide":true}]}`.
   - **Esperado:** 201.
2. Leia o treino:
   - **Requisição:** `GET /workouts/<id>`.
   - **Esperado:** os itens com faixa, `rpe: "8.5"`, `supersetGroup: 1` e `perSide: true` no segundo.
3. Crie um item só com tempo:
   - **Requisição:** `POST /workouts` com `{"name":"Prancha","items":[{"exerciseId":"<id>","order":1,"targetSets":3,"targetDurationSeconds":60}]}`.
   - **Esperado:** 201.
4. Mande o campo antigo:
   - **Requisição:** `POST /workouts` com `targetReps` no lugar da faixa.
   - **Esperado:** 400.
5. Mande os dois indicadores de intensidade:
   - **Requisição:** um item com `rir` e `rpe` juntos.
   - **Esperado:** 400.
- [ ] Rodei o comportamento e ele faz o que os critérios pedem.
