# Plano de risco: tarefa 13 — registro de refeição (`MealLog`, `MealLogItem`)

Aprovado por: humano em 2026-11-23 (na conversa). R6 e as decisões técnicas do agente foram delegadas pelo humano a um agente avaliador; o veredito dele está abaixo.
Veredito do avaliador (2026-11-23): MANTER R6 e as decisões técnicas, com três precisões aplicadas: travas sem o plano, ordem das travas no `PUT` e início do dia sem "meia-noite".
Revisão do plano: AJUSTAR nas duas rodadas de 2026-11-23. Os 11 pontos e os 3 riscos da 1ª rodada foram resolvidos na 2ª. O único ponto da 2ª (dividir a 13a em 13a-1 e 13a-2 já no plano, com o limite de ~300 linhas) foi aplicado e não passou por uma 3ª rodada.

A tarefa 13 de `docs/produto.md` sai em **três PRs** (regra 6, limite de ~300 linhas). A estimativa vem da 11b-1 (#51), que teve ~380 linhas de `src` + schema e mais 64 de migration, para 3 tabelas e 4 rotas.
- **13a-1:** tabelas, criar (idempotente pelo id do aparelho) e ler por id (C1–C8, C10, C11). Estimativa: ~290 linhas de `src` + schema, mais a migration.
- **13a-2:** listagem por dia no fuso do perfil (C9 e o 401 da listagem). Estimativa: ~70 linhas, sem migration.
- **13b:** corrigir com `PUT` e apagar com `DELETE`, com marcador de exclusão (C12–C17). Estimativa: ~130 linhas, com migration própria para `deleted_at`.

O documento usa "13a" para a 13a-1 e a 13a-2 juntas. A seção "Registro de refeição" do `docs/domain.md` e o ADR 0015 entram na 13a-1. Este arquivo fica até o PR da 13b, que o remove.

## Decisões do humano (2026-11-23)
Gravadas em `docs/domain.md` no PR da 13a, numa seção nova "Registro de refeição" com as regras R1–R6. O mesmo PR:
- atualiza o item (c) "Registro", a linha 37 (alcance do offline) e a **linha 249** (fuso), conforme R5;
- atualiza C1 e C3, com as FKs novas e a ordem da exclusão de conta: itens → registros → usuário;
- traz o **ADR 0015**, "Registro de refeição offline e exclusão com marcador", com R1, R4, o 410 e a revisão do alcance do ADR 0004. O ADR 0004 ganha a nota "revisado pelo ADR 0015", e o ADR 0001/S9 ganha a nota de que a **sessão de treino continua sem exclusão**.

As regras:
- **R1.** O registro de refeição **funciona offline, como o treino**. O `id` é gerado no aparelho e o reenvio não duplica: é o mesmo contrato do [ADR 0013](../adr/0013-idempotencia-por-id-do-cliente.md). Isso amplia o alcance do offline do ADR 0004. O lote `POST /sync` continua na tarefa 17.
- **R2.** O registro tem data e hora (`eatenAt`) e pode apontar, **opcionalmente**, para uma refeição de um plano do usuário e para a refeição modelo usada.
  - O nome da refeição fica copiado no registro.
  - Se o plano, a refeição ou a refeição modelo for apagado, o registro continua, só sem a ligação.
  - Um lanche fora do plano também pode ser registrado.
- **R3.** Cada item é **alimento + gramas**, de alimento do catálogo ou próprio. O item guarda a cópia (snapshot) do nome, do estado e dos macros já calculados para as gramas. Editar ou apagar o alimento depois não muda o histórico (invariante 16).
- **R4.** O usuário pode **corrigir** (`PUT`, estado completo) e **apagar** (`DELETE`) um registro. O registro apagado fica marcado por dentro, e o reenvio do mesmo `id` por um aparelho antigo não o ressuscita.
- **R5.** O dia de um registro é a data local de `eatenAt` **no fuso do perfil do usuário** (U9). Isso revisa a linha 249, onde a consulta "por dia" usava o fuso do aparelho em cada pedido ou UTC. **Consequência:** trocar o fuso do perfil muda o dia em que os registros antigos aparecem na listagem.

Proposta do agente, que o avaliador delegado confirma:
- **R6.** Pelo menos 1 item. O mesmo alimento repetido no registro dá 400, como em M8 e na refeição modelo. Gramas vão de 0 a 99999.9, com até 1 casa (D4).

## Decisões técnicas do agente (não mudam regra de negócio)
- **Rotas:**
  - 13a: `POST /meal-logs`, `GET /meal-logs?date=AAAA-MM-DD` e `GET /meal-logs/:id`;
  - 13b: `PUT /meal-logs/:id` e `DELETE /meal-logs/:id`.

  Todas com `AuthGuard`; o `userId` vem do token. Nas rotas com `:id`, o id vale sem diferenciar maiúsculas: é buscado em minúsculas (ADR 0013).
- **Corpo do `POST`:** `{ id, eatenAt, mealSlotId?, mealTemplateId?, items: [{ foodId, grams }] }`.
  - `id` é um UUID, gravado em minúsculas.
  - `eatenAt` é validado exatamente como o `startedAt` da sessão: ISO 8601 com data, hora e fuso, data possível e ano UTC até 9999 (`AnoUtcAte9999`). É gravado em UTC, sem validar a faixa, como em S1.
  - `mealTemplateId` exige `mealSlotId` e precisa ser uma refeição modelo dessa refeição.
  - `mealSlotId` precisa ser uma refeição de um plano do usuário, ativo ou não.
- **Corpo do `PUT` (13b):** o mesmo do `POST`, **sem** `id`. Um `id` no corpo dá 400 pela whitelist.
- **Idempotência (ADR 0013):** a ordem das checagens é esta:
  1. DTO e alimento repetido (R6) → 400. Por isso, um reenvio com alimento repetido no corpo dá 400, não 200 nem 409.
  2. Busca pelo `id`. Se é do usuário e não está apagado, devolve 200 com o registro original, sem alterar nada, mesmo com corpo diferente. Se é do usuário e está apagado (13b), devolve 410. Se é de outro usuário, apagado ou não, devolve 409 `"Registro de refeição já existe"`, sem dados.
  3. Referências: refeição e refeição modelo → 400; alimento → 404.
  4. `create` → 201.

  A transação do `create` trava **só as linhas** da refeição (`FOR SHARE OF meal_slots`) e da refeição modelo (`FOR SHARE` em `meal_templates`), sem travar `diet_plans`, e depois os alimentos (`FOR SHARE`, ordenados por id), nessa ordem. Travar o plano junto daria deadlock com o `PATCH` do plano, que trava o plano e depois as refeições. Um `P2002` (dois envios ao mesmo tempo) aborta a transação. A releitura pelo `id` roda **fora** dela e aplica o passo 2.
- **Snapshot por item:** `foodId` (FK `SET NULL`), `foodName`, `foodState`, `grams` e os macros para as gramas: `kcal`, `proteinG`, `carbsG`, `fatG` e `fiberG` (`null` se o alimento não tem fibra).
  - Cada macro é o valor por 100 g × gramas ÷ 100, em décimos inteiros (sem ponto flutuante, como na tarefa 12), arredondado a 1 casa com o meio para cima. Ex.: gordura 2.5 × 150 g = 3.75 → `"3.8"`.
  - O tipo é `Decimal(8,1)`, porque 900 kcal × 99999.9 g ÷ 100 = 899999.1.
- **Resposta:** `{ id, eatenAt, mealSlotId, mealSlotName, mealTemplateId, items: [{ foodId, name, state, grams, kcal, proteinG, carbsG, fatG, fiberG }], totals: { kcal, proteinG, carbsG, fatG, fiberG }, createdAt, updatedAt }`. Os valores saem como texto, e a resposta não traz `userId`.
  - **`totals` soma os snapshots já arredondados dos itens**, de propósito: o total bate com a soma dos itens que o usuário vê, e o histórico é a cópia gravada. A refeição modelo (11b-2) arredonda a soma, porque calcula com o alimento atual.
  - O `fiberG` dos `totals` é `null` se nenhum item tem fibra.
- **Listagem:** `GET /meal-logs?date=AAAA-MM-DD` devolve os registros do usuário com `eatenAt` naquele dia, no fuso do perfil (R5), ordenados por `eatenAt` e `id`. `date` ausente ou inválida dá 400.
  - Os limites do dia são calculados **no Node**, com o mesmo `Intl` que valida o fuso do perfil. O SQL só recebe instantes UTC, porque o Postgres pode não conhecer um fuso que o ICU aceita.
  - O início do dia D é o **primeiro instante UTC cuja data local, no fuso do perfil, é D**. O intervalo é `[início(D), início(D+1))`. Isso cobre fusos em que a meia-noite não existe, como `America/Santiago` em 2026-09-06, quando o relógio pula de 23:59 para 01:00. Não dá para usar `Temporal`, porque CI e Docker rodam Node 24.
- **Tabelas (13a):**
  - `meal_logs`: `id` PK vindo do cliente; `user_id` FK `RESTRICT`; `eaten_at`; `meal_slot_id` FK `SET NULL`; `meal_slot_name` `VarChar(100)` nulo; `meal_template_id` FK `SET NULL`; timestamps; índice (`user_id`, `eaten_at`).
  - `meal_log_items`: `meal_log_id` FK **`RESTRICT`** (histórico não usa cascade, ADR 0001; análogo a `SetLog.sessionId`); `food_id` FK `SET NULL`; `position`; snapshot; índices em `meal_log_id` e `food_id`.

  Nenhuma tabela existente muda. A exclusão de conta (C1) vai apagar itens → registros → usuário, explicitamente.
- **13b:** coluna `deleted_at` em `meal_logs`, com migration própria.
  - Registro apagado some de `GET /:id`, da listagem e do `PUT`, que dão 404 `"Registro de refeição não encontrado"`.
  - O reenvio do `POST` pelo dono dá **410** `"Registro de refeição apagado"`; ele não é recriado. Por outro usuário, dá 409, sem revelar que o registro foi apagado.
  - O `PUT` substitui `eatenAt`, as refeições e os itens (apaga os itens antigos e cria os novos), com os snapshots recalculados com o alimento atual, e mantém o `id`.
  - O `DELETE` dá 204 e grava `deleted_at`. Os itens ficam.
  - Ordem na transação: primeiro refeição, refeição modelo e alimentos com `FOR SHARE`; depois o registro com `FOR UPDATE`, filtrando `user_id` e `deleted_at IS NULL` (404 se sumiu); depois apagar e recriar os itens. Travar o registro antes daria deadlock com o `PATCH` do plano que apaga a refeição, porque o `SET NULL` em `meal_logs` precisa da linha do registro.

## Critérios de aceite

Testes em `test/meal-logs.e2e-spec.ts`.

### 13a-1: tabelas, criar e ler (C1–C8, C10, C11) · 13a-2: listar por dia (C9)
- [ ] C1: `POST /meal-logs` com `id` do aparelho, `eatenAt` com fuso, refeição "Almoço" de um plano, a refeição modelo dela e 2 itens (frango 150 g, arroz 100 g) → 201 no formato acima, sem `userId`:
  - `mealSlotName: "Almoço"`;
  - item frango: `grams "150"`, `kcal "238.5"`, `proteinG "48"`, `carbsG "0"`, `fatG "3.8"` (3,75 com o meio para cima), `fiberG null`;
  - `totals`: `kcal "368.5"`, `fatG "4.1"` (3.8 + 0.3).

  Teste: confere o corpo e as contas.
- [ ] C2: registro sem refeição e sem refeição modelo (lanche fora do plano) → 201 com `mealSlotId`, `mealSlotName` e `mealTemplateId` iguais a `null`. Teste.
- [ ] C3: reenvio do mesmo `id` pelo mesmo usuário, mesmo com corpo diferente → 200 com o registro original e nada alterado. O `id` em maiúsculas vale o mesmo. `id` de outro usuário → 409 `"Registro de refeição já existe"`, sem dados do outro. Teste.
- [ ] C4: 10 rodadas de dois `POST` com o mesmo `id` ao mesmo tempo → um 201 e um 200, sem 500 e com um registro só no banco. Teste com `Promise.all` em laço.
- [ ] C5: o snapshot não muda depois do registro. `PATCH /foods/:id` que muda kcal e nome, e depois `DELETE /foods/:id` do alimento → o `GET` do registro devolve os mesmos valores e nomes, com `foodId: null` depois de apagar. Teste.
- [ ] C6: o histórico sobrevive ao plano. `PATCH` do plano que apaga a refeição, e depois `DELETE` do plano → o registro continua, com `mealSlotId` e `mealTemplateId` iguais a `null` e `mealSlotName` mantido. Teste.
- [ ] C7: corpo inválido → 400, nada gravado. Casos:
  - `id` ausente ou que não é uuid;
  - `eatenAt` ausente, sem fuso, só data, com data impossível ou `9999-12-31T23:59:00-01:00` (ano UTC acima de 9999);
  - `items` ausente ou vazio;
  - `grams` negativo, com 2 casas, acima de 99999.9 ou em texto;
  - `foodId` que não é uuid;
  - alimento repetido (`"Alimento repetido"`);
  - `userId` ou campo desconhecido.

  `grams` 0 e 99999.9 → 201. Teste: tabela de casos.
- [ ] C8: referências inválidas, nada gravado:
  - `mealSlotId` que não é de um plano do usuário → 400 `"Refeição não encontrada"`;
  - `mealTemplateId` sem `mealSlotId`, ou de outra refeição → 400 `"Refeição modelo não pertence à refeição"`;
  - alimento alheio ou inexistente → 404 `"Alimento não encontrado"`.

  Teste: um caso por item.
- [ ] C9: `GET /meal-logs?date=` lista só os registros do usuário naquele dia, no fuso do perfil, ordenados por `eatenAt` e `id`. Teste com o perfil em `America/Sao_Paulo`:
  - um registro às `2026-11-23T23:30:00-03:00` aparece em `date=2026-11-23` e não em `2026-11-24`;
  - um às `2026-11-24T01:00:00Z` (22h do dia 23 em São Paulo) aparece em `2026-11-23`;
  - registros de outro usuário não aparecem;
  - com o perfil trocado para `Asia/Tokyo`, o mesmo registro muda de dia.

  `date` ausente, impossível (`2026-02-30`) ou em outro formato → 400. Teste unitário da função dos limites do dia: em `America/Santiago`, `2026-09-06` começa em `2026-09-06T04:00:00Z` (01:00 local, porque a meia-noite não existe); em `America/Sao_Paulo`, `2026-11-23` começa em `2026-11-23T03:00:00Z`.
- [ ] C10: `GET /meal-logs/:id` do próprio → 200 no formato de C1, também com o id em maiúsculas. Registro de outro usuário ou inexistente → 404 `"Registro de refeição não encontrado"`. Id que não é uuid → 400. Teste.
- [ ] C11: corridas, nos dois casos sem 500:
  - 10 rodadas de `POST` com um alimento próprio e `DELETE /foods/:id` desse alimento ao mesmo tempo → no fim, ou o registro existe com o snapshot completo, ou o `POST` deu 404;
  - 10 rodadas de `POST` numa refeição e `PATCH` do plano que apaga essa refeição ao mesmo tempo → o `POST` deu 201 (e o registro fica com `mealSlotId: null`) ou 400.

  Sem token → 401 em todas as rotas (a listagem, na 13a-2); corpo acima de 100 KB → 413. Teste.

### 13b: corrigir e apagar
- [ ] C12: `PUT /meal-logs/:id` com o estado completo → 200 com o mesmo `id`, também com o id em maiúsculas na rota. `eatenAt`, as refeições e os itens passam a ser os enviados, os snapshots são recalculados com o alimento atual, e os itens antigos saem (contagem no banco). Teste.
- [ ] C13: o `PUT` passa pelas mesmas regras de C7 e C8, e um `id` no corpo dá 400. Um erro → 400 ou 404, e nada alterado. Teste com quatro casos: `id` no corpo, `items` vazio, refeição alheia e alimento alheio.
- [ ] C14: `DELETE /meal-logs/:id` → 204. Depois disso, `GET`, `PUT` e um segundo `DELETE` dão 404, e o registro some da listagem do dia. Teste.
- [ ] C15: reenvio do `POST` com o `id` de um registro apagado → pelo dono, 410 `"Registro de refeição apagado"`, sem recriar (contagem no banco); por outro usuário, 409 `"Registro de refeição já existe"`. Teste.
- [ ] C16: registro de outro usuário ou inexistente → 404 em `PUT` e `DELETE`. Teste.
- [ ] C17: 10 rodadas de `PUT` e `DELETE` do mesmo registro ao mesmo tempo → sem 500. No fim o registro está apagado (o `PUT` deu 200 antes ou 404 depois). Também 10 rodadas de `PUT` (que reenvia a mesma refeição) com `PATCH` do plano que apaga essa refeição → sem 500 (o `PUT` dá 200, e o registro fica com `mealSlotId: null`, ou 400). Teste.

Fora de escopo:
- a tela Hoje: soma do dia contra a meta do tipo de dia e por refeição (tarefa 15);
- o lote `POST /sync` (tarefa 17);
- registrar pela refeição modelo com a porção calculada no servidor (o app calcula com a função da tarefa 12 e envia os itens);
- item avulso sem alimento (decisão do humano);
- household (tarefa 16);
- a rota de exclusão de conta (C1 só ganha a ordem);
- validar no `PATCH /me/profile` que o Postgres conhece o fuso (não é preciso, porque o cálculo do dia fica no Node).

## Risco
- **Zona tocada:** `prisma/schema.prisma` e `prisma/migrations/` (13a: 2 tabelas novas; 13b: 1 coluna nova). São dados de saúde do usuário. Contrato de sincronismo: ADR 0013 aplicado a `/meal-logs`, mais o 410 da 13b (ADR 0015).
- **Como desfazer:** reverter na ordem inversa dos PRs.
  - 13b: num **mesmo PR e mesmo deploy**, `git revert` **e** uma migration nova que primeiro remove de fato os registros apagados, e só depois apaga a coluna:
    ```sql
    DELETE FROM meal_log_items WHERE meal_log_id IN (SELECT id FROM meal_logs WHERE deleted_at IS NOT NULL);
    DELETE FROM meal_logs WHERE deleted_at IS NOT NULL;
    ALTER TABLE meal_logs DROP COLUMN deleted_at;
    ```
  - 13a: `git revert` **e** uma migration nova que apaga `meal_log_items` e `meal_logs`, nessa ordem. Os registros feitos desde o deploy se perdem; a perda é aceita porque a API não está em produção (U8).
  - Para guardar os dados antes: `pg_dump --data-only -t meal_logs -t meal_log_items "${DATABASE_URL%%\?*}" > registros.sql`.
  - Como as FKs para `foods`, `meal_slots` e `meal_templates` são `SET NULL`, reverter só o código não barra exclusão nenhuma.
- **Pré-mortem:**
  - dois envios do mesmo `id` geram duplicata ou 500 → releitura fora da transação depois do `P2002` (C4);
  - o histórico muda quando o alimento é editado → snapshot (C5);
  - apagar o plano apaga o histórico → `SET NULL`, com o nome copiado (C6);
  - a refeição é apagada entre a validação e o `INSERT` e vira `P2003` (500) → `FOR SHARE` na refeição e na refeição modelo (C11);
  - deadlock com o `PATCH` do plano → travar só as linhas da refeição e da refeição modelo, sem o plano (C11); na 13b, travar as referências antes do registro (C17);
  - a meia-noite não existe em alguns fusos (horário de verão) → início do dia = primeiro instante com aquela data local (teste unitário em C9);
  - o dia errado por fuso desloca refeições da noite para o dia seguinte → R5 (C9);
  - um fuso aceito pelo ICU do Node e desconhecido do Postgres faz a listagem dar 500 → limites do dia calculados no Node;
  - um aparelho antigo ressuscita um registro apagado → 410 (C15);
  - o 410 revela a outro usuário que um registro existiu → 409 para quem não é dono (C15);
  - um usuário lê o registro de outro, ou usa a refeição ou o alimento de outro → filtro por `userId` (C3, C8, C10);
  - o alimento some entre a validação e a gravação → `FOR SHARE` (C11).
- **Segurança** (skill `seguranca`, seções "Em todo tipo de trabalho" e "API"):
  - *Autorização por objeto:* aplica-se, porque é dado de saúde privado. Toda query filtra por `userId`; refeição, refeição modelo e alimento só valem se forem do usuário (ou do catálogo, no caso do alimento). O 409 do `id` alheio, apagado ou não, não devolve dados. Verificado por C3, C8, C10, C15 e C16.
  - *Atribuição em massa:* aplica-se. Whitelist; `userId`, campos desconhecidos e `id` no corpo do `PUT` dão 400 (C7, C13).
  - *Entrada e limites:* aplica-se. `eatenAt` com fuso e ano até 9999, gramas com 1 casa até 99999.9, ids como uuid e corpo até 100 KB (C7, C11).
  - *Exposição de dados:* aplica-se. A resposta não traz `userId` (C1).
  - *Falha segura:* aplica-se. A escrita é em transação, e corrida não vira 500 (C4, C11, C17).
  - *Autenticação e sessão, segredos, SSRF, autorização por função, injeção:* não se aplicam. Não há mudança em `src/auth/`, segredo, URL de usuário nem papel; o SQL cru tem só parâmetros.
  - *Dependências:* nenhuma nova.
  - *Modelo de ameaças:* o ativo é o histórico alimentar, que é dado de saúde. Ameaça: um usuário adivinha o `id` de outro e lê o registro, ou descobre que ele foi apagado → 409 sem dados e 404 no `GET` (C3, C10, C15). Ameaça: corpo gigante → 413 (C11).
- **Dependências novas:** nenhuma.

## Validação do humano
Com o app no ar (`docker compose up -d`, `npx prisma migrate deploy`, `npm run start:dev`):

```sh
curl -s -X POST localhost:3000/auth/register -H 'Content-Type: application/json' -d '{"name":"Teste","email":"registro@example.com","password":"password123"}'
T=$(curl -s -X POST localhost:3000/auth/login -H 'Content-Type: application/json' -d '{"email":"registro@example.com","password":"password123"}' | sed 's/.*"accessToken":"\([^"]*\)".*/\1/')
PLANO=$(curl -s -X POST localhost:3000/diet-plans -H "Authorization: Bearer $T" -H 'Content-Type: application/json' -d '{"name":"Déficit","mealSlots":[{"name":"Almoço","order":1}],"dayTypes":[{"name":"Todos","order":1,"kcal":2400}],"trainingDayTypeOrder":1,"restDayTypeOrder":1}')
ALMOCO=$(echo "$PLANO" | sed 's/.*"mealSlots":\[{"id":"\([^"]*\)".*/\1/')
FRANGO=$(curl -s -X POST localhost:3000/foods -H "Authorization: Bearer $T" -H 'Content-Type: application/json' -d '{"name":"Frango","state":"COOKED","kcal":159,"proteinG":32,"carbsG":0,"fatG":2.5}' | sed 's/^{"id":"\([^"]*\)".*/\1/')
ARROZ=$(curl -s -X POST localhost:3000/foods -H "Authorization: Bearer $T" -H 'Content-Type: application/json' -d '{"name":"Arroz","state":"COOKED","kcal":130,"proteinG":2.5,"carbsG":28,"fatG":0.3}' | sed 's/^{"id":"\([^"]*\)".*/\1/')
echo "$ALMOCO $FRANGO $ARROZ"   # três uuids
```

Depois da 13a-1 (passos 1, 2 e 5) e da 13a-2 (passos 3 e 4):
1. Registre o almoço: `curl -s -X POST localhost:3000/meal-logs -H "Authorization: Bearer $T" -H 'Content-Type: application/json' -d "{\"id\":\"11111111-1111-4111-8111-111111111111\",\"eatenAt\":\"2026-11-23T12:30:00-03:00\",\"mealSlotId\":\"$ALMOCO\",\"items\":[{\"foodId\":\"$FRANGO\",\"grams\":150},{\"foodId\":\"$ARROZ\",\"grams\":100}]}"` → 201 com `"mealSlotName":"Almoço"`, frango com `"kcal":"238.5"` e `"fatG":"3.8"`, e `totals.kcal` = `"368.5"`.
2. Repita o mesmo comando → 200 com o mesmo registro, sem duplicar.
3. Registre um jantar às 22h de São Paulo, em UTC: o mesmo comando com `"id":"22222222-2222-4222-8222-222222222222"` e `"eatenAt":"2026-11-24T01:00:00Z"` → 201.
4. `curl -s "localhost:3000/meal-logs?date=2026-11-23" -H "Authorization: Bearer $T"` → os dois registros, almoço e depois jantar, porque o perfil começa em `America/Sao_Paulo`. `?date=2026-11-24` → `[]`.
5. `curl -s -X PATCH localhost:3000/foods/$FRANGO -H "Authorization: Bearer $T" -H 'Content-Type: application/json' -d '{"kcal":200}'` e depois `curl -s localhost:3000/meal-logs/11111111-1111-4111-8111-111111111111 -H "Authorization: Bearer $T"` → o `kcal` do frango continua `"238.5"`.

Depois da 13b:
6. `curl -s -X DELETE localhost:3000/meal-logs/11111111-1111-4111-8111-111111111111 -H "Authorization: Bearer $T"` → 204. Repita o comando do passo 1 → 410 `"Registro de refeição apagado"`.
