# Plano de risco: ficha vira treino e schema do programa (tarefa 6)

> Só risco alto. Descartável: o essencial vai para a descrição do PR e este arquivo é removido (`git rm`) no mesmo PR.

Aprovado por: humano em 2026-11-11 (na conversa: "aprovado")
Revisão do plano: AJUSTAR aceito pelo humano em 2026-11-11: 2 rodadas do revisor-de-plano (8 ajustes na 1ª, 1 na 2ª); a única pendência da 2ª (registrar no domain.md as regras de weeks, dia sem treino e caminhada) foi aplicada no plano.

Tarefa 6 de `docs/produto.md`. Regras de base em `docs/domain.md`:
- decisão (d) e decisão (e) (caminhada no `DayLog`);
- F1–F11, S1–S9, C1 e C3.

ADR de base: [ADR 0011](../adr/0011-app-generico-plano-e-dado.md). Novo nesta tarefa: **ADR 0014, "A ficha vira treino; o programa organiza os treinos"**. Ele altera a consequência do ADR 0011 que dizia que `WorkoutRoutine` e `RoutineItem` seriam "absorvidos por `Program`".

**Decisões do humano (2026-11-11):**
1. **A ficha vira "treino" (`Workout`).**
   - A ficha atual passa a ser o treino (ex.: "Treino A").
   - O `Program` só organiza os treinos no ciclo.
   - Sessões e histórico continuam apontando para os mesmos registros, sem cópia de dados.
   - As fichas existentes viram treinos fora de programa.
   - Alternativa descartada: cada ficha virar um programa.
2. **Vários programas por usuário, um ativo por vez.** A tela Hoje usa o ativo, e ativar um programa desativa o anterior. A regra entra em vigor com a API da tarefa 7.

**Divisão entre as tarefas 6 e 7** (o `produto.md` é atualizado no mesmo PR):
- **Tarefa 6 (esta):**
  - renomeia ficha para treino no banco, no código e nas rotas;
  - cria as tabelas do programa, ainda sem rota;
  - passa as duas FKs que faltavam de C3 para `RESTRICT`.
- **Tarefa 7:**
  - CRUD de `/programs`, com ciclo, ativação e validação de que o dia do programa só aponta para treino do dono;
  - campos novos do item do treino (tipo de série, faixa de repetições, tempo ou por lado, descanso, superssérie, RIR/RPE), com migration, validação e limites;
  - vira risco **alto**, porque terá migration (`AGENTS.md`).

Assim, cada campo novo nasce junto com a regra que o usa.

**Decisões técnicas (agente):**

1. **Renomeação no banco sem cópia de dados.** A migration é gerada com `--create-only` e o SQL é editado **antes de ser aplicado**. A migration ainda não aplicada pode ser editada; a regra do `AGENTS.md` vale para migration aplicada. Os nomes vêm das migrations `20260819144834_create_routines_and_routine_items_tables` e `20261110120000_schema_log_treino`:

   | Antes | Depois | Como |
   |---|---|---|
   | tabela `workout_routines` | `workouts` | `ALTER TABLE … RENAME TO` |
   | tabela `routine_items` | `workout_items` | `ALTER TABLE … RENAME TO` |
   | coluna `routine_items.routine_id` | `workout_items.workout_id` | `RENAME COLUMN` |
   | coluna `workout_sessions.routine_id` | `workout_id` | `RENAME COLUMN` |
   | `workout_routines_pkey` | `workouts_pkey` | `RENAME CONSTRAINT` (renomeia junto o índice da PK) |
   | `routine_items_pkey` | `workout_items_pkey` | `RENAME CONSTRAINT` |
   | `routine_items_routine_id_fkey` | `workout_items_workout_id_fkey` | `RENAME CONSTRAINT` (continua `CASCADE`) |
   | `workout_sessions_routine_id_fkey` | `workout_sessions_workout_id_fkey` | `RENAME CONSTRAINT` (continua `RESTRICT`) |
   | `workout_routines_user_id_fkey` | `workouts_user_id_fkey` | `DROP` e `ADD` com `ON DELETE RESTRICT ON UPDATE CASCADE` (C3) |
   | `routine_items_exercise_id_fkey` | `workout_items_exercise_id_fkey` | `DROP` e `ADD` com `ON DELETE RESTRICT ON UPDATE CASCADE` (C3) |

   Não há outros índices nessas tabelas. O SQL final não pode ter `DROP TABLE` nem `DROP COLUMN`. O critério de aceite desses nomes é o `migrate diff` vazio (C3).

2. **Contrato da API**, trocado agora porque ainda não há front:

   - **Rotas:** `/routine` vira `/workouts` (`POST`, `GET`, `GET /:id`, `PUT /:id`). Os quatro métodos em `/routine` passam a dar 404.
   - **Resposta do treino:**
     - `routineItems` vira `items`;
     - em cada item, `routineId` vira `workoutId`;
     - a chave do exercício incluído, `exercices` (grafia errada), vira `exercise`.
   - **Sessão:**
     - `POST /sessions` recebe e devolve `workoutId` no lugar de `routineId`, e `routineId` no body dá 400;
     - `PATCH /sessions/:id` devolve `workoutId`.
   - **Mensagens:** "Ficha de treino não encontrada" vira "Treino não encontrado", e "Ficha de treino sem exercícios" vira "Treino sem exercícios".
   - Nenhum outro comportamento muda: status, validações e isolamento continuam iguais.

3. **`Program`:**
   - `id`, `userId` (FK `RESTRICT`), `name` (até 100);
   - `cycleType` (`WEEKLY` ou `ROTATING`);
   - `cycleDays`: 7 no semanal, N no rotativo;
   - `weeks`: alternância por semana, que pela decisão (d) só existe no semanal. No rotativo é sempre 1;
   - `startDate` (data), que ancora o ciclo;
   - `active` (booleano);
   - timestamps.

   A regra de contagem de qual semana e qual dia valem hoje, a partir de `startDate` e do fuso do usuário, fica para a tarefa 15 (`GET /today`).

4. **`ProgramDay`:**
   - `id`, `programId` (FK `CASCADE`, porque o dia é parte do programa, como o item é parte do treino);
   - `week` (1..`weeks`);
   - `day`: dia da semana 1 a 7 no semanal, posição 1..N no rotativo;
   - `workoutId` (FK `RESTRICT`);
   - `order`, que permite mais de um treino no mesmo dia.

   **Dia sem linha é dia sem treino.** Nesse dia, a tela Hoje mostra a caminhada, que é hábito do registro diário (`DayLog`, decisão (e), tarefa 15), e não um tipo de dia do programa. Uma caminhada planejada como treino é um `Workout` com exercício de cardio. Por isso o `ProgramDay` não precisa de tipo nem de `workoutId` opcional.

   Os limites desses números ficam para a tarefa 7.

5. **"Um ativo por usuário" fica fora do banco nesta tarefa.** Será garantido no service da tarefa 7, porque o Prisma não declara índice parcial no schema, e um índice só no SQL viraria drift no `migrate diff`.

## Critérios de aceite
Testes existentes migram para os nomes novos (veja "Testes alterados").

**Renomeação e contrato**
- [ ] C1 (contrato do treino): `/workouts` responde como `/routine` respondia, com as rotas `POST`, `GET`, `GET /:id` e `PUT /:id`, e com os mesmos status, validações, isolamento por usuário (F1) e F6. A resposta usa `items`, `workoutId` no item e `exercise`.
  - **Teste:** os casos de `test/routines.e2e-spec.ts` e `test/routines-caracterizacao.e2e-spec.ts`, renomeados para `test/workouts.e2e-spec.ts` e `test/workouts-caracterizacao.e2e-spec.ts`.
  - **Caso novo:** "`POST`, `GET`, `GET /:id` e `PUT /:id` em `/routine` dão 404".
- [ ] C2 (contrato da sessão): `POST /sessions` recebe `workoutId` e responde com `workoutId`. `routineId` no body dá 400. `PATCH /sessions/:id` responde com `workoutId`. As regras S1–S9 continuam iguais.
  - **Teste:** os casos de `test/sessions.e2e-spec.ts` e `test/sessions-caracterizacao.e2e-spec.ts`, com o campo renomeado, incluindo a conferência das chaves exatas da sessão.
  - **Caso novo:** "routineId no body dá 400".
- [ ] C3 (dados e schema): a migration preserva os dados e o banco fica igual ao schema. Verificação no Postgres local, com as saídas no PR:
  1. **Semente**, na `main` e antes da migration, por SQL com ids fixos. Um usuário, um exercício, uma ficha com dois itens, uma sessão e uma série, todos com prefixo `c3seed` no nome e no e-mail:
     `docker exec treino_postgres psql -U postgres -d exactafitdb -f -` com o script, que vai no PR.
  2. **Antes:**
     `docker exec treino_postgres psql -U postgres -d exactafitdb -c "SELECT (SELECT count(*) FROM workout_routines) w, (SELECT count(*) FROM routine_items) i, (SELECT count(*) FROM workout_sessions) s, (SELECT count(*) FROM set_logs) l;"`
     Todas as contagens maiores que zero.
  3. **Aplicar** com `npx prisma migrate deploy` (pede a confirmação do humano).
  4. **Depois**, as mesmas quatro contagens:
     `... -c "SELECT (SELECT count(*) FROM workouts) w, (SELECT count(*) FROM workout_items) i, (SELECT count(*) FROM workout_sessions) s, (SELECT count(*) FROM set_logs) l;"`
  5. **Semente intacta:**
     `... -c "SELECT s.workout_id = '<id da ficha semeada>' AS mesma, (SELECT count(*) FROM workout_items WHERE workout_id = '<id da ficha semeada>') itens FROM workout_sessions s WHERE s.id = '<id da sessão semeada>';"`
     Deve dar `mesma = t` e `itens = 2`.
  6. **Schema igual ao banco:**
     `npx prisma migrate diff --from-config-datasource --to-schema prisma/schema.prisma --exit-code`
     Deve dar código de saída `0` (diff vazio).
  7. **Limpeza da semente:** `DELETE` por id, na ordem séries → sessão → itens → ficha → exercício → usuário.

**FKs que faltavam de C3** (testes no banco, via Prisma, em `test/workouts-caracterizacao.e2e-spec.ts`, bloco "histórico")
- [ ] C4: apagar no banco um usuário que tem treino é recusado (`P2003`). Antes, o treino saía em cascata.
- [ ] C5: apagar no banco um exercício que está num item de treino é recusado (`P2003`). Antes, o item saía em cascata.

**Tabelas do programa** (testes no banco, via Prisma, em `test/programs-schema.e2e-spec.ts`)
- [ ] C6: um programa `WEEKLY` com `weeks` 2 e dias nas semanas 1 e 2 apontando para dois treinos do usuário é gravado e lido de volta com os dias. O mesmo treino em dois dias, e dois treinos no mesmo dia (`order` 1 e 2), também são aceitos.
- [ ] C7: um programa `ROTATING` com `cycleDays` 5 é gravado com dias só nas posições 1, 2 e 4 (3 e 5 sem treino).
- [ ] C8:
  - apagar um treino que está num dia de programa é recusado (`P2003`);
  - apagar um usuário que tem programa é recusado (`P2003`);
  - apagar o programa leva os dias em cascata, e os treinos ficam.

**Testes alterados** (`Teste alterado: <motivo>` no commit):
- **Renomeação em todos os e2e:**
  - `/routine` vira `/workouts`, `routineId` vira `workoutId`, `routineItems` vira `items` e `exercices` vira `exercise`;
  - `prisma.workoutRoutine` vira `prisma.workout` e `prisma.routineItem` vira `prisma.workoutItem`;
  - as mensagens passam a dizer "Treino".

  Arquivos:
  - `test/routines*.e2e-spec.ts`, renomeados para `test/workouts*.e2e-spec.ts`;
  - `test/sessions.e2e-spec.ts`;
  - `test/sessions-caracterizacao.e2e-spec.ts` (chaves exatas da sessão e o C10, que usa o Prisma);
  - `test/authguard-caracterizacao.e2e-spec.ts` (`GET /routine` vira `GET /workouts`);
  - `test/exercises*.e2e-spec.ts`, onde citarem ficha.

  Nenhuma verificação é removida.
- **Limpeza:** com C4, C5 e C8, o banco não apaga mais em cascata. Os `afterAll` de `test/sessions.e2e-spec.ts`, `test/sessions-caracterizacao.e2e-spec.ts`, `test/workouts.e2e-spec.ts`, `test/workouts-caracterizacao.e2e-spec.ts`, `test/exercises.e2e-spec.ts` e `test/programs-schema.e2e-spec.ts` passam a apagar nesta ordem:
  1. séries;
  2. sessões;
  3. programas (os dias saem em cascata);
  4. treinos (os itens saem em cascata);
  5. exercícios;
  6. usuários.
- **Specs unitários de sessions:** os mocks seguem os nomes novos.

**Atualizações em `docs/domain.md` no mesmo PR:**
- **Glossário:**
  - "Ficha" vira "Treino" (`Workout`);
  - "Item da ficha" vira "Item do treino" (`WorkoutItem`);
  - "Sessão … a partir de uma ficha" passa a dizer "de um treino";
  - "Programa" deixa de dizer "substitui a ficha" e passa a dizer "organiza os treinos no ciclo", com um ativo por usuário (decisão 2 do humano).
- **Decisão (d):**
  - o item "`WorkoutRoutine` e `RoutineItem` são absorvidos por `Program` e `WorkoutItem`" é reescrito conforme a decisão 1 do humano e o ADR 0014;
  - o schema do programa fica marcado como implementado;
  - entram as regras novas:
    - os campos de `Program` e `ProgramDay` (decisões técnicas 3 e 4);
    - `weeks` só existe no semanal, e no rotativo é sempre 1;
    - dia sem linha no programa é dia sem treino; nesse dia, a caminhada vem do hábito do `DayLog` (decisão (e)), e não de um tipo de dia do programa.
- **Regras F:**
  - o cabeçalho passa a valer para `Workout` e `WorkoutItem`, com os mesmos números;
  - a coluna "Onde" de F1–F11 aponta para `src/workouts/…`;
  - F9: `GET /routine` vira `GET /workouts`;
  - na tabela de mudanças, F11 passa a ser a constraint (`workoutId`, `order`), e F9 também é atualizado.
- **S1 e S9:** "ficha da sessão" e `routineId` passam a "treino da sessão" e `workoutId`.
- **C1:** a exclusão de conta passa a remover programas (e seus dias) antes dos treinos.
- **C3:**
  - `Workout.userId` e `WorkoutItem.exerciseId` passam a `RESTRICT`;
  - FKs novas: `Program.userId` `RESTRICT`, `ProgramDay.workoutId` `RESTRICT` e `ProgramDay.programId` `CASCADE`.
- **Casos de borda 1 e 2, e demais menções a `/routine`, `routineId`, `RoutineItem` e `routine.service.ts`:** renomeados.

**Atualizações em `docs/produto.md` no mesmo PR:**
- **Seção 9:** a tarefa 6 descreve o que entra aqui. A tarefa 7 passa a incluir os campos do item, com migration, e vira risco **alto**.
- **Seção 4, "Alteradas":** as fichas viram treinos e o programa os organiza.

**ADR 0014** no mesmo PR, com:
- a decisão 1 do humano e a alternativa descartada;
- a troca de contrato da API;
- a regra de um programa ativo;
- a mudança na consequência do ADR 0011.

**Fora de escopo** (tarefa 7, salvo indicação):
- Rotas de programa (`/programs`) e ativação.
- Validação de que cada dia do programa aponta só para treino do dono do programa. É autorização por objeto, e o banco não garante. O service da tarefa 7 valida, com teste lá.
- Campos novos do item do treino.
- Validação dos números do ciclo.
- Regra de contagem do dia de hoje (tarefa 15).
- `order` único (F11) e arquivamento (F9).
- Índice de uma sessão aberta por usuário (S3, tarefa 17).

## Risco
- **Zona tocada:** `prisma/schema.prisma` e `prisma/migrations/`, numa migration nova com renames, duas FKs refeitas e duas tabelas novas. O código fica em `src/routines/` (vira `src/workouts/`), `src/sessions/` e `src/app.module.ts`. `src/auth/` não é tocado.
- **Como desfazer:**
  - **Antes do merge:** fechar o PR.
  - **Depois do merge:** um PR de reversão que faz duas coisas juntas:
    - **Código:** reverte `src/`, o schema e os testes, **mantendo** a pasta da migration.
    - **Banco:** acrescenta uma migration nova que remove `program_days` e `programs`, volta as duas FKs para `CASCADE` e renomeia tabelas, colunas e constraints de volta, usando a tabela da decisão técnica 1 no sentido inverso.
  - Os renames são simétricos e não perdem dado. Programas criados entre o merge e a reversão seriam perdidos, mas até a tarefa 7 não existe rota para criá-los.
- **Pré-mortem:**
  1. **O Prisma gera drop e create em vez de rename e apaga dados.** Mitigação:
     - SQL editado antes de aplicar;
     - o revisor confere que não há `DROP TABLE` nem `DROP COLUMN`;
     - o C3 compara as contagens com dados semeados (maiores que zero) e confere a ligação sessão → treino pelo id;
     - `migrate diff` vazio.
  2. **Ficou um uso esquecido de `routine`, e a rota ou o campo antigo continua aceito.** Mitigação: o C1 testa que os quatro métodos de `/routine` dão 404, o C2 testa que `routineId` dá 400, e o revisor roda `git grep -n -i routine src/ test/`.
  3. **A limpeza dos testes quebra com as FKs `RESTRICT`.** Mitigação: a ordem única dos `afterAll` (seção "Testes alterados").
  4. **O CI aplica as migrations do zero e algum nome de constraint não bate.** Mitigação: os nomes vêm das migrations versionadas (tabela da decisão técnica 1), o `migrate diff` vazio no banco local e o CI e o e2e local rodando as migrations do zero.
- **Segurança** (skill `seguranca`, seção API):
  - **Autorização por objeto: se aplica.** O isolamento de F1 (treino de outro usuário dá 404) e o de E1/F6 precisam sobreviver à renomeação. Verificado pelos casos existentes, que são renomeados e não apagados (C1). O dono cruzado no `ProgramDay` fica explicitamente para a tarefa 7, porque sem rota não há como explorá-lo.
  - **Inventário de rotas: se aplica.** A rota antiga não pode continuar viva. Verificado pelo C1 (os quatro métodos de `/routine` dão 404).
  - **Mass assignment: se aplica.** `routineId` e `userId` extras continuam dando 400. Verificado pelo C2 e pelos casos existentes de `userId` no body.
  - **Fluxos sensíveis e API externa: não se aplicam**, porque não há fluxo novo nem consumo externo.
  - **Modelo de ameaças:** esta tarefa não cria ativo nem rota de escrita nova. O risco é regressão do isolamento existente durante a renomeação, coberto pelo C1 e pelo C2.
  - **ADR:** sim, o 0014.
- **Dependências novas:** nenhuma.
- **Tamanho:** cerca de 200 linhas de produção, a maior parte renomeação, mais cerca de 60 linhas de schema e de SQL. Os testes mudam muito, mas de forma mecânica.

## Validação do humano
Com o app no ar (`docker compose up -d`, `npx prisma migrate deploy`, `npm run start:dev`):

1. Crie um usuário e faça login. Pegue o id de um exercício em `GET /exercises` (se a lista vier vazia, crie um com `POST /exercises`).
2. `POST /workouts` com `{"name":"Treino A","items":[{"exerciseId":"<id>","order":1,"targetSets":3,"targetReps":10}]}`.
   - **Esperado:** 201, com `items[0].workoutId` igual ao id do treino.
3. `GET /workouts`.
   - **Esperado:** o treino aparece com `items` e, em cada item, `exercise`.
4. `POST /routine` com o mesmo body.
   - **Esperado:** 404.
5. `POST /sessions` com `{"id":"<uuid novo>","workoutId":"<id do treino>","startedAt":"2026-11-11T10:00:00-03:00"}`.
   - **Esperado:** 201 com `workoutId`.
6. Confira no PR as saídas do C3: dados semeados antes da migration, contagens iguais depois, a sessão semeada ligada ao mesmo treino e o `migrate diff` vazio.
