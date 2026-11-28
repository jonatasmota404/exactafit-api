# Plano de risco: `POST /sync`, lote idempotente e uma sessão aberta por usuário (tarefa 17)

> **Risco alto.** Motivos: migration com dados (`prisma/migrations/`, `prisma/schema.prisma`), contrato externo com o app (lote offline) e concorrência (S3). Este arquivo é removido no PR que fechar a tarefa (17b).

Aprovado por: humano em 2026-11-25
Revisão do plano: AJUSTAR na 2ª rodada (revisor-de-plano, 2026-11-25); as 5 pendências foram aplicadas no plano e vão ao humano para aceite: busca pelo id dentro da trava no online, releitura do P2002 fora da transação com teste alterado declarado, DTOs de item (finishedAt null = ausente; sessionId não-UUID = 400), repetidos em minúsculas e item não-objeto, comando do passo 1 do C12. AJUSTAR aceito pelo humano em 2026-11-25.

## Decisões do humano (2026-11-25)
- **Conteúdo do lote:** só criações, ou seja:
  - sessões, com `finishedAt` se foram encerradas offline;
  - séries;
  - registros de refeição.

  Corrigir e apagar continuam pelas rotas atuais.
- **Encerrar pelo lote:** uma sessão já **aberta** no servidor que chega no lote com `finishedAt` é encerrada com esse `finishedAt`. Se ela já está encerrada, nada muda (S9: não reabre, e vence o primeiro encerramento). O `startedAt` nunca muda pelo lote.
- **Disputa de S3:** entram todas as abertas do usuário, tanto as do servidor quanto as do lote. Fica aberta a de `startedAt` mais recente. No **empate, vence a de maior `id`**. As demais são encerradas com `finishedAt = startedAt`.
- **Erro num item:** cada item tem o próprio resultado, e os itens bons são gravados. Só um corpo que não é lote dá 400 inteiro.
- **Tamanho:** o limite de corpo de 100 KB (padrão do Express, que o projeto não configura em `src/main.ts`), com 413 acima disso. Não há teto de itens.

## Contrato (vira o ADR 0016 no PR 17a; o ADR 0004 deixou o formato para o plano)

**Corpo do `POST /sync`** (rota autenticada): `{ sessions?: [...], sets?: [...], mealLogs?: [...] }`.
- Cada lista é opcional. Lote vazio → 200 com as listas vazias.
- Campo de topo desconhecido, lista que não é array ou corpo que não é objeto → 400 inteiro.
- Formato de cada item:
  - sessão: `{ id, workoutId, startedAt, finishedAt? }`, com os formatos de S1 e do ADR 0013;
  - série: `{ id, sessionId, exerciseId, setNumber, repsCompleted?, weightKg?, durationSeconds?, failed? }`, com os formatos de S5 e S7;
  - registro de refeição: o corpo do `POST /meal-logs` (R1–R6).
- Cada item é validado com `whitelist` e `forbidNonWhitelisted`, de modo que um campo `userId` no item dá erro 400 naquele item. Os DTOs de item são estes:
  - **sessão:** os campos de `CreateSessionDto` mais `finishedAt` com o formato do `UpdateSessionDto`. `finishedAt: null` vale como ausente (sessão aberta), diferente do `PATCH`, onde `null` dá 400. O motivo é que o aparelho manda `null` para a sessão aberta, e no lote isso não reabre nada.
  - **série:** os campos de `CreateSetDto` mais `sessionId`, que precisa ser UUID (senão 400 no item). Na rota individual ele vem da URL.
  - **registro de refeição:** `CreateMealLogDto`.
- Um item que não é objeto (`null`, número ou texto) dá `error` 400 só naquele item, com `id: null`.

**Resposta 200:** `{ sessions: [r], sets: [r], mealLogs: [r], autoClosedSessionIds: [id] }`.
- Cada lista vem **na ordem enviada**, com `r = { id, status, error? }`.
- `status` vale:
  - `created`: o item foi gravado agora;
  - `existing`: já estava gravado e nada mudou;
  - `closed`: sessão existente, encerrada pelo `finishedAt` do lote;
  - `error`: o item não foi gravado.
- `error = { statusCode, message }`. Código e `message` são **iguais aos da rota individual**: no 400 de formato, `message` é a lista de textos do ValidationPipe; nos 404, 409 e 410, é um texto. O tipo é `string | string[]`.
- `id` vem em minúsculas, ou `null` se o item não trouxe um `id` válido.
- A resposta não devolve o registro, só `id` e `status`.
- **`id` repetido dentro do mesmo lote** (por lista; a comparação é feita **depois de passar o `id` para minúsculas**): só a primeira ocorrência é processada. As seguintes recebem `existing` se a primeira foi gravada ou já existia, e o mesmo `error` se a primeira deu erro.

**Algoritmo das sessões**, numa transação curta:
1. Fora da transação, validar o formato de cada item e descartar as repetições.
2. Abrir a transação e travar a linha do usuário (`SELECT 1 FROM users WHERE id = $1 FOR NO KEY UPDATE`, como na ativação de programa, `programs.service.ts:198`).
3. Para cada sessão válida, **antes de qualquer escrita**:
   - `id` de outro usuário → `error` 409 "Id de sessão já utilizado" (texto da rota atual; o implementador confere);
   - `id` do usuário → `existing`, ou `closed` se a sessão está aberta e o item traz `finishedAt`;
   - `id` novo → conferir o treino (inexistente ou de outro usuário → `error` 404 "Treino não encontrado"); se passar, a sessão é candidata.
4. Escolher a vencedora entre as abertas do servidor (depois do passo 3) e as candidatas sem `finishedAt`, por (`startedAt`, `id`) decrescente.
5. Escrever nesta ordem:
   1. os `finishedAt` dos itens `closed`;
   2. as perdedoras do servidor, encerradas com `finishedAt = startedAt`;
   3. as candidatas perdedoras, gravadas já encerradas;
   4. as candidatas que vieram com `finishedAt`;
   5. a vencedora nova, aberta, por último.
6. `autoClosedSessionIds` lista as perdedoras dos passos 5.2 e 5.3.

O `POST /sessions` online passa a fazer o seguinte numa transação que trava a linha do usuário:
1. **Refaz a busca pelo `id` dentro da trava.** Se a sessão é do usuário → 200 com a original (reenvio, ADR 0013). Se é de outro usuário → 409.
2. Só então confere a sessão aberta e faz o `create`.

Assim as duas rotas se serializam, e o reenvio concorrente do mesmo `id` continua dando 200/201 (`test/sessions-caracterizacao.e2e-spec.ts:261`). Um `P2002` (por exemplo, da versão antiga do app durante o deploy) aborta a transação (25P02). Por isso a releitura pelo `id` é feita **fora** dela, com `this.prisma`, como no ADR 0015: se a sessão existe → reenvio; se não → 409 "Já existe uma sessão aberta". Erro inesperado na fase de sessões → 500 do lote e rollback das sessões. Como o reenvio é idempotente, é só reenviar.

As séries e os registros de refeição são processados **depois**, item a item e fora da transação das sessões. Eles reaproveitam a lógica das rotas individuais, incluindo o tratamento de `P2002` delas.

## Critérios de aceite

### PR 17a: índice de S3, sessões e séries no lote

**Corpo e reenvio**
- [ ] C1: casos do corpo, testados em `test/sync.e2e-spec.ts`:
  - sem token → 401;
  - campo de topo desconhecido, lista que não é array ou corpo que não é objeto → 400;
  - corpo acima de 100 KB → 413;
  - lote vazio → 200 `{ sessions: [], sets: [], mealLogs: [], autoClosedSessionIds: [] }`.
- [ ] C2: sessão nova com `finishedAt` → `created`, gravada encerrada. Sem `finishedAt` → `created`, aberta. Teste em `test/sync.e2e-spec.ts`.
- [ ] C3: **o mesmo lote enviado duas vezes** → na segunda resposta, todas as sessões e séries vêm `existing`, `autoClosedSessionIds` vem `[]` e a contagem de `workout_sessions` e `set_logs` do usuário fica igual. Teste em `test/sync.e2e-spec.ts`.
- [ ] C4: sessão que já existe no servidor, testada em `test/sync.e2e-spec.ts`:
  - aberta no servidor + mesmo `id` no lote com `finishedAt` → `closed`, com o `finishedAt` gravado e o `startedAt` intacto;
  - já encerrada no servidor + `finishedAt` diferente → `existing`, nada muda;
  - aberta no servidor + lote sem `finishedAt` → `existing`.
- [ ] C5: `id` repetido no mesmo lote, testado em `test/sync.e2e-spec.ts`:
  - duas sessões com o mesmo `id` (a primeira sem `finishedAt`, a segunda com) → a primeira `created` e aberta, a segunda `existing`, nada encerrado;
  - duas séries com o mesmo `id` → `created` e depois `existing`;
  - primeira ocorrência com erro → a repetição traz o mesmo `error`;
  - mesmo `id` em caixas diferentes (`ABC…` e `abc…`) → tratado como repetido, sem 500;
  - item `null`, número ou texto na lista → `error` 400 nesse item, `id: null`, e o resto do lote é gravado.

**Disputa de S3**
- [ ] C6: duas sessões abertas no lote (T1 < T2) → T2 fica aberta e T1 é encerrada com `finishedAt = startedAt`. As duas vêm `created`, e `autoClosedSessionIds = [T1]`. Teste em `test/sync.e2e-spec.ts`.
- [ ] C7: disputa com sessão aberta no servidor, testada em `test/sync.e2e-spec.ts`:
  - aberta no servidor (T1) + aberta no lote (T2 > T1) → a do servidor é encerrada e listada em `autoClosedSessionIds`;
  - T2 < T1 → a do lote nasce encerrada e é ela a listada;
  - empate de `startedAt` → fica aberta a de maior `id`;
  - uma sessão de outro usuário, aberta, nunca é encerrada.

**Erros por item**
- [ ] C8: erros de sessão viram item `error` sem derrubar o lote. Teste em `test/sync.e2e-spec.ts`, com um lote que tem um item bom e um ruim de cada tipo, conferindo `statusCode` e `message`:
  - formato inválido → 400, com `message` como lista, igual ao `POST /sessions`;
  - campo `userId` no item → 400;
  - `finishedAt: null` → `created`, aberta;
  - `finishedAt` em formato inválido → 400;
  - treino inexistente ou de outro usuário → 404 "Treino não encontrado";
  - `id` de sessão de outro usuário → 409.

  Treino sem itens e treino arquivado são **aceitos** (S4 e S1).
- [ ] C9: séries, testadas em `test/sync.e2e-spec.ts`:
  - série nova → `created`;
  - reenvio → `existing`;
  - série de sessão do mesmo lote, ou de sessão encerrada (inclusive encerrada automaticamente) → `created`;
  - `setNumber` repetido (S8) → `error` 409, sem derrubar o lote;
  - sessão inexistente ou de outro usuário → `error` 404 "Sessão não encontrada";
  - exercício invisível → `error` 404 "Exercício não encontrado";
  - `id` de série de outro usuário → `error` 409;
  - `id` de série do usuário já usado em **outra sessão** → `error` 409, igual à rota (`sessions.service.ts:158-160`);
  - formato inválido → `error` 400;
  - `sessionId` que não é UUID → `error` 400.

**Concorrência**
- [ ] C10: corrida entre rotas:
  - dois `POST /sessions` online simultâneos, com ids diferentes → um 201 e um 409 "Já existe uma sessão aberta";
  - um `POST /sync` (sessão aberta mais recente) simultâneo a um `POST /sessions` → o `/sync` dá **200** e o online dá 201 ou 409;
  - dois `POST /sessions` simultâneos com o **mesmo** `id` → 201 e 200, sem duplicar. O teste existente `test/sessions-caracterizacao.e2e-spec.ts:261` continua passando sem mudança;
  - em todos os casos, o usuário termina com **exatamente uma** aberta, e nenhuma resposta é 500.

  Testes: `Promise.all` em `test/sync.e2e-spec.ts`. Mais um caso determinístico em `src/sessions/sessions.service.spec.ts`, no padrão do bloco "P2002 na criação": `P2002` com releitura pelo `id` vazia → `ConflictException('Já existe uma sessão aberta')`. Hoje esse caso relança e dá 500. **Teste alterado:** o mock de `sessions.service.spec.ts` ganha `$transaction` e `$queryRaw`, e as sequências de `mockResolvedValueOnce` do bloco "P2002 na criação" acompanham a busca pelo `id` dentro da transação. O que os testes verificam não muda, e o motivo vai na mensagem do commit (regra 3).

**Migration e índice**
- [ ] C11: o índice parcial existe:
  - é declarado no schema como `@@unique([userId], map: "workout_sessions_one_open_per_user", where: raw("finished_at IS NULL"))`, com o preview `partialIndexes`;
  - `npx prisma migrate diff` entre as migrations e o schema sai vazio (sem drift);
  - uma inserção direta de uma segunda aberta para o mesmo usuário falha por unicidade.

  Teste: a inserção direta em `test/sync.e2e-spec.ts`, mais o comando de diff na evidência do PR.
- [ ] C12: a migration roda **numa transação explícita**: `BEGIN; LOCK TABLE workout_sessions IN SHARE ROW EXCLUSIVE MODE; UPDATE …; CREATE UNIQUE INDEX …; COMMIT;`. O `UPDATE` encerra as abertas excedentes de cada usuário pela regra de S3, com empate pelo maior `id`, gravando `finished_at = started_at`. Verificação com passos concretos (implementador, e o testador repete):
  1. criar um banco descartável e aplicar as migrations da `main`:
     - `docker exec treino_postgres psql -U postgres -c "CREATE DATABASE mig17"`;
     - `git worktree add <scratchpad>/main-wt main`, e `npm ci` nesse worktree;
     - no worktree, `DATABASE_URL=postgresql://postgres:<senha>@localhost:5433/mig17 npx prisma migrate deploy`;
  2. inserir, para o usuário U1, duas abertas com `started_at` diferentes;
  3. inserir, para o usuário U2, duas abertas com o mesmo `started_at`;
  4. na branch, `DATABASE_URL=…/mig17 npx prisma migrate deploy`. No fim, apagar o banco `mig17` (`dropdb`, pelo humano se o hook bloquear) e remover o worktree.

  Esperado:
  - U1 fica com a mais recente aberta;
  - U2 fica com a de maior `id` aberta;
  - as outras ficam com `finished_at = started_at`;
  - o índice existe e `_prisma_migrations` registra a migration como aplicada.

### PR 17b: registros de refeição no lote
- [ ] C13: registros de refeição no lote, testados em `test/sync.e2e-spec.ts`:
  - registro novo → `created`;
  - reenvio → `existing`;
  - `id` de registro apagado pelo dono → `error` 410 "Registro de refeição apagado";
  - `id` de outro usuário → `error` 409;
  - refeição, refeição modelo ou alimento inválidos → `error` com o código e a mensagem do `POST /meal-logs`;
  - formato inválido → `error` 400;
  - um item ruim não derruba os outros;
  - `id` repetido no lote segue a regra do C5.
- [ ] C14: o mesmo lote com sessões, séries e registros, enviado duas vezes, não duplica nada: a contagem das três tabelas fica igual. Teste em `test/sync.e2e-spec.ts`.

**Fora de escopo:**
- corrigir e apagar pelo lote (fila de operações);
- sincronismo da API para o aparelho;
- refresh de token (U6: um aparelho que passa mais de 7 dias offline precisa de novo login);
- como o app mostra a sessão encerrada automaticamente (o `TODO(humano)` do ADR 0004 fica para o front; a API só informa `autoClosedSessionIds`);
- teto de itens por lote;
- rate limit.

## Documentação no PR 17a
- `docs/domain.md`:
  - S3: exceção do sincronismo implementada; empate pelo maior `id`; o índice saiu de "fica para a tarefa 17"; o online trava a linha do usuário;
  - bloco (a): formato do sincronismo, deixando de ser `ADIADO`, com remissão ao ADR 0016; "encerrar pelo lote"; regra do `id` repetido no lote;
  - S4 e S8: lote implementado;
  - tabela "Mudanças de código decorrentes": S3 e S8.
- `docs/adr/0016-contrato-do-sync.md`: contrato, algoritmo, status por item e o preview `partialIndexes`.
- `docs/produto.md`: na linha da tarefa 17, 17a feito e 17b pendente. No PR 17b, a tarefa 17 inteira feita, e `git rm` deste plano.

## Risco
- **Zona tocada:**
  - `prisma/schema.prisma`: preview `partialIndexes` e o `@@unique` acima;
  - `prisma/migrations/`: migration nova com `UPDATE` de dados e o índice.

  Verificado em 2026-11-25, numa cópia do schema no scratchpad, com o `@@unique` acima e o preview:

  ```
  $ npx prisma validate --schema <scratchpad>/pi/schema.prisma
  The schema at …/pi/schema.prisma is valid 🚀
  $ npx prisma validate --schema <scratchpad>/pi/no-preview.prisma   # mesmo schema sem o preview
  Error code: P1012
  error: Error parsing attribute "@@unique": Partial indexes are a preview feature. Add "partialIndexes" to previewFeatures in your generator block.
  ```

  A versão instalada é `prisma` 7.9.1 (`node -e "console.log(require('prisma/package.json').version)"`). O PR repete essa evidência com o schema real. Por isso o índice fica declarado no schema e não vira drift, que foi o motivo que barrou o índice na tarefa 7a. **A conferir na implementação:** se o `@@unique([userId], where)` faz o client gerado aceitar `userId` como chave em `findUnique` ou `upsert`. Se fizer, é proibido usar essas consultas por `userId` (registrar no ADR 0016), e `npm run typecheck` precisa continuar limpo.
- **Como desfazer:**
  1. Revert do código do PR, **mantendo a pasta da migration aplicada**, e uma migration nova com `DROP INDEX "workout_sessions_one_open_per_user";` e a remoção do preview e do `@@unique` no schema.
  2. Para reabrir uma sessão encerrada pela migration, primeiro o `DROP INDEX` (senão o `UPDATE` pode bater no índice) e depois `UPDATE workout_sessions SET finished_at = NULL WHERE id IN (…)`, com os ids guardados pela consulta da Validação do humano. S9 proíbe reabrir pela API.
  3. Se a migration falhar no meio (P3009), seguir o procedimento do ADR 0010. Como ela roda numa transação explícita, uma falha não deixa o `UPDATE` aplicado.
- **Pré-mortem:**
  1. Produção tem usuários com várias sessões abertas (de antes da tarefa 3). A migration as encerra com duração zero. Mitigação: é a regra de S3 aprovada; o humano lista os ids antes do deploy e faz backup (Validação do humano).
  2. Durante o rolling update do ADR 0010, a **versão antiga** do app continua servindo depois da migration. O `POST /sessions` dela relança o `P2002` do índice numa corrida e dá 500. Risco aceito e passageiro: dura só a troca de contêiner e exige dois inícios simultâneos do mesmo usuário.
  3. Um lote grande segura a transação. Mitigação: o limite de 100 KB, e a transação cobre só a fase de sessões, travando apenas a linha do usuário.
  4. A sintaxe do preview muda numa atualização do Prisma. O `prisma validate` e o `prisma generate` do CI acusam. Fica registrado no ADR 0016.
  5. Um erro de banco dentro da transação das sessões aborta a transação inteira (25P02). Por isso todas as checagens que podem falhar são feitas antes da primeira escrita, e a ordem de escrita nunca viola o índice.
  6. Uma exceção inesperada num item → 500 do lote (falha segura: o aparelho reenvia, e o que já foi gravado volta `existing`). Só erros conhecidos (400, 404, 409, 410) viram item `error`.
  7. Alguém configura o body parser depois e o limite de 100 KB muda sem aviso. O C1 trava o limite atual em teste.
- **Segurança** (skill `seguranca`, seções "Em todo tipo de trabalho" e "API"):
  - *Autorização por objeto* — aplica. O `userId` vem só do token. Cada referência (treino, sessão, exercício, refeição, alimento) é conferida contra o dono, reaproveitando os serviços atuais. Um `id` alheio dá 409 sem dados, e uma sessão alheia nunca é encerrada. Verificação: C7, C8, C9 e C13.
  - *Entrada e atribuição em massa* — aplica. Cada item é validado com os DTOs das rotas individuais, e `userId` no item → 400. Verificação: C1 e C8.
  - *Limites de uso* — aplica. 100 KB por corpo (413). Sem rate limit, que não existe no projeto e fica fora do escopo. Verificação: C1.
  - *Exposição de dados* — aplica. O item `error` traz só código e mensagem, e o sucesso traz só `id` e `status`. Verificação: C8 e revisão.
  - *Falha segura* — aplica. Erro inesperado → 500 e rollback da fase de sessões; o reenvio é idempotente. Verificação: revisão.
  - *Logs* — aplica. Nada do corpo do lote vai para log, porque são dados de saúde (decisão (f)). Verificação: revisão do diff.
  - *Autenticação e sessão* — não se aplica: reaproveita o `AuthGuard` sem mudança.
  - *Autorização por função, segredos, SSRF, dependências e consumo de outras APIs* — não se aplicam: o projeto não tem papéis, e a tarefa não cria segredo novo, não busca URL do usuário, não adiciona dependência e não consome API externa.
  - *Modelo de ameaças:*
    - **Ativos:** histórico de treino e de refeição (dados de saúde).
    - **Quem ataca:** usuário autenticado, curioso ou malicioso.
    - **O que pode dar errado:** gravar ou encerrar sessão de outro usuário adivinhando ids; descobrir que um UUID existe (409, risco aceito no ADR 0013); mandar um lote gigante para travar o banco.
    - **Mitigação:** o dono do token em toda query, 409 sem dados, o limite de corpo e a transação curta.
- **Tamanho:** o 17a fica estimado em 250 a 300 linhas de produção: módulo `sync` (controller, service e validação por item), a trava e o `P2002` em `sessions.service.ts`, e a migration. Se passar de ~300, o 17a se divide em dois: primeiro o índice, a trava online e a migration; depois o lote de sessões e séries. O 17b fica em ~60.
- **Dependências novas:** Nenhuma. `class-validator` e `class-transformer` já estão instalados para validar item a item.

## Validação do humano
**Antes do deploy, em produção:**
1. Fazer backup do Postgres (ADR 0010).
2. Listar e guardar as sessões que a migration vai encerrar:

```sql
SELECT id, user_id, started_at FROM (
  SELECT id, user_id, started_at,
         row_number() OVER (PARTITION BY user_id ORDER BY started_at DESC, id DESC) AS n
  FROM workout_sessions WHERE finished_at IS NULL) s
WHERE n > 1;
```

**Depois do PR 17a**, com o app local (`npm run start:dev`), dois usuários de teste (U e V, por `POST /auth/register`) e um treino com um exercício para cada um:
1. Como U, `POST /sessions` com a sessão A, aberta.
2. Como U, `POST /sync` com `{ "sessions": [{ "id": "<B>", "workoutId": "<treino de U>", "startedAt": "<mais novo que A>" }], "sets": [{ "id": "<S>", "sessionId": "<B>", "exerciseId": "<ex>", "setNumber": 1 }] }`. Esperado: `sessions[0].status = "created"`, `autoClosedSessionIds = ["<A>"]` e `sets[0].status = "created"`.
3. Repetir o mesmo `POST /sync`. Esperado: tudo `existing` e `autoClosedSessionIds = []`.
4. Conferir no banco local:
   - `docker exec treino_postgres psql -U postgres -d exactafitdb -c "SELECT id, started_at, finished_at FROM workout_sessions WHERE user_id = '<U>'"`. Esperado: A com `finished_at = started_at` e B com `finished_at` vazio.
   - `... -c "SELECT count(*) FROM set_logs WHERE session_id = '<B>'"`. Esperado: 1.
5. Como V, `POST /sessions` com a sessão C. Depois, como U, `POST /sync` com `{ "sessions": [{ "id": "<C>", "workoutId": "<treino de U>", "startedAt": "…" }] }`. Esperado: item `error` 409, e a sessão C de V continua como estava.

**Depois do PR 17b:** incluir `"mealLogs": [<corpo de POST /meal-logs>]` no lote, enviar duas vezes e conferir em `GET /meal-logs?date=` que há um registro só.
