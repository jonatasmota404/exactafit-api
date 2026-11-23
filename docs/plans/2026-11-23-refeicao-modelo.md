# Plano de risco: tarefa 11b — refeição modelo (`MealTemplate`)

Aprovado por: humano em 2026-11-23 (na conversa). As recomendações do agente (valores D4, alimento repetido, rotas próprias, nota de D9, precedência do 409, decisões técnicas) foram delegadas pelo humano a um agente avaliador; o veredito dele está abaixo.
Veredito do avaliador (2026-11-23): MANTER as seis recomendações; um acréscimo aplicado (P2003 sem uso encontrado → 409, na seção Concorrência).
Revisão do plano: AJUSTAR nas duas rodadas de 2026-11-23. Os 11 pontos da 1ª rodada foram resolvidos na 2ª. Os 2 pontos da 2ª (caso `FREE` fora do C4; passos de validação do `PUT`) foram aplicados e não passaram por uma 3ª rodada; ficam para o humano conferir.

A tarefa 11 de `docs/produto.md` foi dividida; a 11a (plano, refeições, tipos de dia e metas) está mergeada (#48, #49, #50). A 11b sai em **três PRs** (regra 6), com a estimativa de linhas de produção de cada um tirada da 11a-1 (#48: ~486 linhas para 4 tabelas, DTO aninhado, service e controller):
- **11b-1** — refeição modelo **por componentes**: 3 tabelas e 2 enums, criar, ler, listar, apagar e o 409 do alimento (C1–C12). Estimativa: ~320 linhas (schema ~45, DTO ~65, service ~160, controller ~45, módulo ~10, `foods.service` ~25). **Corte combinado antes:** se passar de ~330, o `GET` da lista e o `DELETE` da refeição modelo (C7 e a primeira parte de C9) saem para um PR próprio, logo depois; schema, migration e a mudança no `DELETE /foods` **ficam juntos** (sem a checagem nova, o `P2003` cairia no 409 com a mensagem do rendimento).
- **11b-2** — composição **livre**: tabela `meal_template_items` com migration própria, `totals` e o 409 do alimento em item (C13–C16). Estimativa: ~130 linhas.
- **11b-3** — substituir com `PUT` (C17–C20). Estimativa: ~100 linhas; sem migration.

**Exceção à regra 6 na 11b-1 (2026-11-23):** a implementação deu ~439 linhas de produção (TS 380 + schema 59; migration SQL ~64 à parte). O corte combinado economizaria só ~40 linhas e geraria um PR de `GET`/`DELETE` sem valor isolado; schema, migration e o 409 do `DELETE /foods` não podem se separar. Precedente: #48 (~486). Decidido pelo agente avaliador a quem o humano delegou as decisões sobre as recomendações do agente ("seguir com a decisão desse agente"); **não** foi aprovação direta do humano, que pode pedir o corte no PR.

Este arquivo fica até o PR da 11b-3, que o remove.

## Decisões do humano (2026-11-23)
Gravadas em `docs/domain.md` no PR da 11b-1, numa seção nova "Refeição modelo" com as regras M1–M8, escritas sempre como "refeição modelo" por extenso. No mesmo PR:
- o glossário ganha "Refeição modelo" (`MealTemplate`) e diz que ela é diferente de "Modelo" (`PlanTemplate`, os perfis A e B);
- o item (c) "Porção" passa a listar o peso do alimento como meta (M4); a linha 75 de `docs/produto.md`, também;
- D9 ganha a nota: a refeição que o `PATCH` do plano apaga, inclusive a reenviada **sem `id`**, leva junto as refeições modelo dela;
- A6/A8 ganham o 409 da refeição modelo (M6), e M6 ganha a nota de catálogo que A7 tem para o rendimento;
- C1 e C3 ganham as FKs novas e a ordem da exclusão de conta (planos antes dos alimentos próprios).

- **M1.** A refeição modelo é **parte do plano** e pertence a **uma refeição** (`MealSlot`). Apagar a refeição (no `PATCH` do plano) ou o plano apaga as refeições modelo dela (`CASCADE`).
- **M2.** Uma refeição pode ter **várias** refeições modelo, cada uma com nome (ex.: Almoço → "Prato padrão", "Marmita"); o usuário escolhe uma na hora de comer (tarefa 13).
- **M3.** Dois tipos: **por componentes** ou **livre**. Um componente tem nome, **uma** meta e uma **lista de opções de alimento**; na hora de comer o usuário escolhe uma opção e a porção sai da meta (tarefa 12).
- **M4.** A meta do componente é de um destes tipos: **kcal**, **gramas de proteína**, **gramas de carboidrato** ou **peso do alimento em gramas** (os "200 g de proteína" do perfil A são 200 g do alimento).
- **M5.** A composição **livre** é uma lista fixa de alimentos com gramas; a API devolve os macros somados.
- **M6.** Apagar um alimento que está numa refeição modelo (opção ou item livre) dá **409**, como o rendimento (A8). **Nota:** como em A7, uma carga ou correção futura do catálogo que apague um alimento fica barrada pelas refeições modelo de qualquer usuário.
- **M7.** Opção cujo alimento tem **0** no nutriente da meta (ex.: frango numa meta de carboidrato) dá **400** ao salvar; com meta de peso, qualquer alimento serve. Se o alimento for editado para 0 depois, a refeição modelo continua salva e a tarefa 12 trata o caso.
- **M8.** **Nada vazio:** pelo menos 1 componente por refeição modelo por componentes, 1 opção por componente e 1 item na composição livre.

Valores e nomes seguem D4 (o humano confirma ao aprovar os critérios): meta e gramas de 0 a 99999.9, até 1 casa; nomes de 1 a 100 caracteres, sem byte nulo; `order` da refeição modelo de 0 a 2147483647, único entre as refeições modelo da mesma refeição; sem teto de quantidade de refeições modelo, componentes, opções ou itens. O mesmo alimento repetido nas opções de um componente ou nos itens livres dá 400.

## Decisões técnicas do agente (não mudam regra de negócio)
- **Rotas próprias** dentro do plano, em vez de aninhar no corpo do `POST`/`PATCH /diet-plans`: `POST /diet-plans/:id/meal-templates`, `GET /diet-plans/:id/meal-templates`, `GET /diet-plans/:id/meal-templates/:templateId`, `DELETE …/:templateId` e `PUT …/:templateId` (11b-3). Assim o contrato do `PATCH` do plano (D9) não muda, e omitir as refeições modelo no `PATCH` não as apaga. O `GET /diet-plans/:id` continua sem elas.
- **Corpo:** `{ mealSlotId, name, order, kind: "COMPONENTS" | "FREE", components?: [{ name, targetType: "KCAL" | "PROTEIN" | "CARBS" | "WEIGHT", targetValue, foodIds: [uuid…] }], items?: [{ foodId, grams }] }`. `COMPONENTS` exige `components` e recusa `items`; `FREE`, o inverso. Na 11b-1, `kind: "FREE"` dá 400 (o enum só ganha `FREE` na 11b-2). A ordem dos componentes, das opções e dos itens é a do array (coluna `position`). `mealSlotId`, `foodIds` e `foodId` com `@IsUUID`, como em `create-food-yield.dto.ts`.
- **Resposta:** `{ id, mealSlotId, name, order, kind, components: [{ id, name, targetType, targetValue, options: [{ foodId, name, state }] }], items: [{ foodId, name, state, grams }], totals, createdAt, updatedAt }`. Em `COMPONENTS`, `items: []` e `totals: null`; em `FREE`, `components: []` e `totals = { kcal, proteinG, carbsG, fatG, fiberG }` = Σ(valor por 100 g × gramas ÷ 100), arredondado a 1 casa (meio para cima), como texto; `fiberG` soma só os itens cujo alimento tem fibra (`null` se nenhum). Calculado na leitura com o alimento atual (não é snapshot).
- **Mensagens:** nutriente 0 → 400 `"Alimento sem o nutriente da meta: <nome do alimento>"`; refeição de fora do plano → 400 `"Refeição não pertence ao plano"`; `order` repetido → 400 `"order já usado por outra refeição modelo desta refeição"`; alimento repetido → 400 `"Alimento repetido"`; alimento alheio ou inexistente → 404 `"Alimento não encontrado"` (como A7); refeição modelo alheia ou inexistente → 404 `"Refeição modelo não encontrada"`; alimento em uso → 409 `"Alimento em uso em refeição modelo"`. Estrutura vazia (C4) e erros de formato (C5) usam a mensagem do class-validator, que o teste não fixa.
- **Tabelas:** `meal_templates` (`meal_slot_id` FK `CASCADE`, `name`, `order`, `kind`; único por (`meal_slot_id`, `order`)), `meal_template_components` (`meal_template_id` FK `CASCADE`, `position`, `name`, `target_type`, `target_value` `Decimal(6,1)`), `meal_template_options` (`component_id` FK `CASCADE`, `food_id` FK `RESTRICT`, `position`; único por (componente, alimento)) — 11b-1; `meal_template_items` (`meal_template_id` FK `CASCADE`, `food_id` FK `RESTRICT`, `position`, `grams` `Decimal(6,1)`; único por (refeição modelo, alimento)) — 11b-2. Nenhuma tabela existente muda.
- **Concorrência:** `POST`, `PUT` e `DELETE` da refeição modelo rodam numa transação que trava a linha do plano (`FOR UPDATE`, a mesma trava do `PATCH` do plano) e depois os alimentos (`FOR SHARE`, numa só consulta ordenada por `id`, como o `POST /food-yields`). O `DELETE /foods/:id` já trava o alimento com `FOR UPDATE`; depois da checagem do rendimento, ganha a da refeição modelo. **Precedência:** alimento num rendimento e numa refeição modelo dá o 409 do rendimento (checado primeiro, como hoje). No `P2003` que escapar, o serviço **não** olha o `meta` do erro: refaz as duas checagens, fora da transação abortada, e escolhe a mensagem com a mesma precedência. Se nenhuma das duas checagens achar uso (a linha que barrou já saiu), devolve 409 `"Alimento em uso em refeição modelo"`, sem cair em 500.
- **Índices e `order` repetido (11b-1):** `@@index([mealTemplateId])` nos componentes e `@@index([foodId])` nas opções (para a FK e para a checagem de uso no `DELETE /foods`). O `order` repetido é checado dentro da transação; o `P2002` do índice único (dois `POST` ao mesmo tempo) vira o mesmo 400 `"order já usado por outra refeição modelo desta refeição"`.
- **Local dos testes de C10 e C11:** ficaram em `test/meal-templates.e2e-spec.ts`, e não em `test/foods.e2e-spec.ts`, porque precisam de plano e refeição modelo.
- **Escrita em lote:** os ids das refeições modelo e dos componentes são gerados na aplicação (`randomUUID` de `node:crypto`) antes de gravar, e componentes, opções e itens vão em um `createMany` por tabela. Assim as opções já sabem o id do componente e não se repete o timeout do #50.

## Critérios de aceite

Testes em `test/meal-templates.e2e-spec.ts`; os do alimento (C10, C11, C15) em `test/foods.e2e-spec.ts`.

### 11b-1: por componentes — tabelas, criar, ler, apagar e alimento em uso
- [ ] C1: `POST /diet-plans/:id/meal-templates` com `kind: "COMPONENTS"`, na refeição "Almoço" do plano, componentes "Proteína" (`WEIGHT` 200, opções frango e patinho) e "Carboidrato" (`KCAL` 190, opções arroz e batata) → 201 no formato da resposta acima (`targetValue: "200"`, componentes e opções na ordem enviada, `items: []`, `totals: null`), sem `userId` — teste: o prato do perfil A.
- [ ] C2: meta `PROTEIN` com opção de alimento de 0 g de proteína, `CARBS` com 0 g de carboidrato ou `KCAL` com 0 kcal → 400 `"Alimento sem o nutriente da meta: <nome>"`, nada gravado; meta `WEIGHT` com esse mesmo alimento → 201 — teste: um caso por tipo de meta.
- [ ] C3: estrutura vazia → 400, nada gravado: `components` ausente ou `[]`; componente com `foodIds: []` — teste: um caso por item.
- [ ] C4: corpo inválido → 400, nada gravado: `kind` desconhecido (ex.: `"OUTRO"`; o caso `"FREE"` não entra no teste, porque só dá 400 até a 11b-2, e o teste ficaria contrário ao C13); `COMPONENTS` com `items`; `targetType` desconhecido; `targetValue` negativo, com 2 casas, acima de 99999.9 ou texto; `name` (refeição modelo ou componente) vazio, acima de 100 caracteres ou com `\u0000`; `order` negativo, fracionário ou acima de 2147483647; `mealSlotId` ou item de `foodIds` que não é uuid; alimento repetido nas opções de um componente (`"Alimento repetido"`); `userId` ou campo desconhecido. `targetValue` 0 e 99999.9 → 201 — teste: tabela de casos.
- [ ] C5: `mealSlotId` que não é refeição deste plano (de outro plano do usuário, de outro usuário ou inexistente) → 400 `"Refeição não pertence ao plano"`; `order` já usado por outra refeição modelo da mesma refeição → 400 `"order já usado por outra refeição modelo desta refeição"`; o mesmo `order` em refeições diferentes → 201 — teste.
- [ ] C6: alimento de outro usuário ou inexistente numa opção → 404 `"Alimento não encontrado"`; alimento do catálogo e próprio → 201 — teste.
- [ ] C7: `GET /diet-plans/:id/meal-templates` → só as refeições modelo do plano, ordenadas pela `order` da refeição, depois `order` da refeição modelo e `id`; `GET …/:templateId` → 200 no formato de C1 — teste: duas refeições modelo em duas refeições, criadas fora de ordem.
- [ ] C8: plano de outro usuário ou inexistente → 404 `"Plano de dieta não encontrado"` em todas as rotas de refeição modelo; refeição modelo de outro plano ou inexistente → 404 `"Refeição modelo não encontrada"` em `GET …/:templateId` e `DELETE` (e `PUT`, na 11b-3); id na rota que não é uuid → 400 — teste.
- [ ] C9: `DELETE …/:templateId` → 204; componentes e opções saem junto (contagem no banco = 0); `PATCH /diet-plans/:id` que apaga a refeição (omitida ou reenviada sem `id`) e `DELETE /diet-plans/:id` apagam as refeições modelo dela (contagem = 0) e os alimentos continuam — teste: os três caminhos.
- [ ] C10: `DELETE /foods/:id` de alimento próprio que é opção de componente → 409 `"Alimento em uso em refeição modelo"`, alimento continua; depois de apagar a refeição modelo → 204. Alimento ao mesmo tempo num rendimento e numa refeição modelo → 409 `"Alimento em uso em rendimento"` (precedência) — teste em `test/foods.e2e-spec.ts`.
- [ ] C11: 10 rodadas de `POST` de refeição modelo com um alimento próprio e `DELETE /foods/:id` desse alimento ao mesmo tempo → nenhum 500; no fim, ou a refeição modelo existe e o `DELETE` deu 409 com a mensagem da refeição modelo, ou o alimento sumiu e o `POST` deu 404 — teste: `Promise.all` em laço.
- [ ] C12: 10 rodadas de `POST` de refeição modelo numa refeição ao mesmo tempo com (a) `PATCH` do plano que apaga essa refeição e (b) `DELETE /diet-plans/:id` → nenhum 500; no fim não sobra refeição modelo pendurada em refeição ou plano apagado (o `POST` deu 201 e ela saiu em cascata, ou deu 400/404). Sem token → 401 em todas as rotas de refeição modelo; corpo acima de 100 KB → 413 — teste.

### 11b-2: composição livre
- [ ] C13: `kind: "FREE"` com itens ovo 100 g e aveia 30 g → 201 com `components: []` e `totals` = soma dos macros arredondada a 1 casa; `fiberG` soma só quem tem fibra (`null` se nenhum tem) — teste: valores conferidos à mão, um caso com fibra mista e um sem fibra.
- [ ] C14: `FREE` sem `items` ou com `items: []`; `FREE` com `components`; `grams` negativo, com 2 casas, acima de 99999.9 ou texto; `foodId` que não é uuid; alimento repetido nos itens → 400, nada gravado; alimento alheio ou inexistente num item → 404 `"Alimento não encontrado"`; `grams` 0 e 99999.9 → 201 — teste: tabela de casos.
- [ ] C15: `DELETE /foods/:id` de alimento próprio que é item livre → 409 `"Alimento em uso em refeição modelo"`; depois de apagar a refeição modelo → 204 — teste em `test/foods.e2e-spec.ts`.
- [ ] C16: `DELETE` da refeição modelo livre, da refeição e do plano apagam os itens (contagem = 0) — teste.

### 11b-3: substituir (`PUT /diet-plans/:id/meal-templates/:templateId`)
- [ ] C17: `PUT` com o estado completo → 200; o `id` da refeição modelo se mantém e componentes, opções e itens passam a ser exatamente os enviados (os antigos saem); dá para trocar `kind`, `mealSlotId` (refeição do mesmo plano) e `order` — teste: troca uma opção, troca de `COMPONENTS` para `FREE`, move para outra refeição; confere contagem no banco.
- [ ] C18: o `PUT` passa pelas mesmas regras de C2–C6 e C14 (com a própria refeição modelo fora da checagem de `order` repetido); erro → 400/404 e nada alterado — teste: três casos (nutriente 0, componente sem opções, `order` de outra refeição modelo da refeição).
- [ ] C19: `PUT` que tira um alimento da refeição modelo libera o `DELETE /foods/:id` desse alimento (204) — teste.
- [ ] C20: 10 rodadas de `PUT` e `DELETE` da mesma refeição modelo ao mesmo tempo → nenhum 500; no fim ela foi apagada (o `PUT` deu 404 ou 200 antes) e não sobra componente, opção nem item órfão — teste.

Fora de escopo: cálculo da porção e o caso do alimento editado para 0 depois (12); registro de refeição e a escolha da refeição modelo na hora de comer (13); modelos dos perfis A e B como dado e copiar plano com as refeições modelo (14); refeições modelo no `GET /diet-plans/:id` e no corpo do `POST`/`PATCH` do plano; rendimento cru → pronto aplicado à opção; compartilhar no household (16); exportar e importar em JSON; a rota de exclusão de conta (C1 só ganha a ordem: planos antes dos alimentos próprios, por causa das FKs `RESTRICT`).

## Risco
- **Zona tocada:** `prisma/schema.prisma` e `prisma/migrations/` (11b-1: 3 tabelas e 2 enums; 11b-2: 1 tabela e o valor `FREE` no enum; nenhuma tabela existente muda). Dados de dieta do usuário. `src/foods/foods.service.ts` (exclusão de alimento).
- **Como desfazer:** reverter na ordem inversa dos PRs. 11b-3: sem migration; `git revert` basta. 11b-2: num **mesmo PR e mesmo deploy**, `git revert` **e** uma migration nova que apaga `meal_template_items`, apaga as refeições modelo `FREE` e recria o enum sem `FREE`. 11b-1: num **mesmo PR e mesmo deploy**, `git revert` **e** uma migration nova que apaga `meal_template_options`, `meal_template_components` e `meal_templates` (nessa ordem) e os enums `MealTemplateKind` e `ComponentTargetType`. As refeições modelo criadas desde o deploy se perdem; aceito porque a API não está em produção (U8). Para guardá-las antes: `pg_dump --data-only -t meal_templates -t meal_template_components -t meal_template_options -t meal_template_items "${DATABASE_URL%%\?*}" > refeicoes-modelo.sql` (sem o `?schema=public`, que o `pg_dump` recusa). Reverter só o código **não basta**: as FKs `RESTRICT` para `foods` continuariam barrando a exclusão de alimento, com a mensagem errada ou 500.
- **Pré-mortem:**
  - `PATCH` ou `DELETE` do plano apaga a refeição enquanto um `POST` de refeição modelo grava nela → FK falha e vira 500 → trava da linha do plano no `POST` (C12);
  - alimento apagado enquanto uma refeição modelo o grava → 500 ou opção apontando para o nada → `FOR SHARE` no `POST` e `FOR UPDATE` no `DELETE /foods` (C11);
  - `DELETE /foods` devolve a mensagem do rendimento para alimento só em refeição modelo, ou 500 → checagem explícita e, no `P2003`, as duas checagens refeitas (C10, C11);
  - cliente reenvia as refeições no `PATCH` do plano sem `id` e perde todas as refeições modelo sem aviso → comportamento de D9, documentado na nota de D9 e coberto em C9;
  - refeição modelo impossível de usar (opção com 0 no nutriente, componente vazio) → C2, C3;
  - muitos componentes estouram o timeout da transação, como no #50 → ids gerados antes e `createMany`; corpo limitado a 100 KB (C12);
  - um usuário usa alimento próprio de outro ou lê refeição modelo de outro plano → filtro por `userId` no plano e no alimento (C6, C8).
- **Segurança** (skill `seguranca`, seções "Em todo tipo de trabalho" e "API"):
  - *Autorização por objeto:* aplica-se (plano e alimento próprio são privados). Plano filtrado por `userId` do token; `mealSlotId` só vale se for do plano; alimento só do catálogo ou do usuário; refeição modelo só do plano. Verificado por C5, C6, C8 e C14.
  - *Atribuição em massa:* aplica-se. Whitelist; `userId` e campo desconhecido dão 400 (C4).
  - *Entrada e limites:* aplica-se. Valores 0 a 99999.9 com 1 casa; nomes até 100 e sem byte nulo; `order` no int4; ids do corpo como uuid; enums fechados; corpo até 100 KB (C4, C12, C14).
  - *Exposição de dados:* aplica-se. Resposta sem `userId`; o alimento aparece só com `foodId`, `name` e `state` (C1).
  - *Falha segura:* aplica-se. Transação (nada gravado em erro: C2–C5, C14, C18); corrida não vira 500 (C11, C12, C20).
  - *Autenticação e sessão, segredos, SSRF, autorização por função, injeção:* não se aplicam (sem mudança em `src/auth/`, sem segredo, sem URL de usuário, sem papel; SQL cru só nas travas, com parâmetros do Prisma).
  - *Dependências:* não se aplica (nenhuma nova).
  - *Modelo de ameaças:* ativo = plano de dieta e alimentos próprios. Ameaça: usuário pendura na sua refeição modelo o alimento próprio de outro (e assim trava a exclusão dele com 409) → alimento alheio dá 404 (C6, C14). Ameaça: corpo gigante → 413 (C12).
- **Dependências novas:** Nenhuma.

## Validação do humano
Com o app no ar (`docker compose up -d`, `npx prisma migrate deploy`, `npm run start:dev`), crie um usuário e guarde o token em `$T` como na validação da 11a (`POST /auth/register` e `POST /auth/login`).

Depois da 11b-1:
1. Crie um plano com a refeição "Almoço": `curl -s -X POST localhost:3000/diet-plans -H "Authorization: Bearer $T" -H 'Content-Type: application/json' -d '{"name":"Déficit","mealSlots":[{"name":"Almoço","order":1}],"dayTypes":[{"name":"Todos","order":1,"kcal":2400}],"trainingDayTypeOrder":1,"restDayTypeOrder":1}'`. Anote `<plano>` e o id da refeição `<almoco>`.
2. Crie dois alimentos próprios (`POST /foods`): "Frango" (`COOKED`, 159 kcal, 32 g de proteína, 0 de carboidrato, 2.5 de gordura) e "Arroz" (`COOKED`, 130 kcal, 2.5 de proteína, 28 de carboidrato, 0.3 de gordura). Anote `<frango>` e `<arroz>`.
3. Crie o prato: `curl -s -X POST localhost:3000/diet-plans/<plano>/meal-templates -H "Authorization: Bearer $T" -H 'Content-Type: application/json' -d '{"mealSlotId":"<almoco>","name":"Prato padrão","order":1,"kind":"COMPONENTS","components":[{"name":"Proteína","targetType":"WEIGHT","targetValue":200,"foodIds":["<frango>"]},{"name":"Carboidrato","targetType":"KCAL","targetValue":190,"foodIds":["<arroz>"]}]}'` → 201.
4. Outro prato, com `"order":3`, `"name":"Teste"` e o segundo componente com `"targetType":"CARBS"` e `"foodIds":["<frango>"]` → 400 `"Alimento sem o nutriente da meta: Frango"`.
5. `curl -s -X DELETE localhost:3000/foods/<frango> -H "Authorization: Bearer $T"` → 409 `"Alimento em uso em refeição modelo"`.

Depois da 11b-2:
6. Uma refeição modelo livre: `curl -s -X POST localhost:3000/diet-plans/<plano>/meal-templates -H "Authorization: Bearer $T" -H 'Content-Type: application/json' -d '{"mealSlotId":"<almoco>","name":"Marmita","order":2,"kind":"FREE","items":[{"foodId":"<frango>","grams":150},{"foodId":"<arroz>","grams":100}]}'` → 201 com `totals.kcal` = `"368.5"` (159 × 1,5 + 130). Anote `<prato>` (passo 3) e `<marmita>`.

Depois da 11b-3 (antes do passo final, que apaga o Almoço):
7. Troque a opção do componente "Proteína" do prato de frango para arroz: `curl -s -X PUT localhost:3000/diet-plans/<plano>/meal-templates/<prato> -H "Authorization: Bearer $T" -H 'Content-Type: application/json' -d '{"mealSlotId":"<almoco>","name":"Prato padrão","order":1,"kind":"COMPONENTS","components":[{"name":"Proteína","targetType":"WEIGHT","targetValue":200,"foodIds":["<arroz>"]},{"name":"Carboidrato","targetType":"KCAL","targetValue":190,"foodIds":["<arroz>"]}]}'` → 200 com `"id":"<prato>"` e a opção da "Proteína" = Arroz.
8. Tire o frango da marmita: `curl -s -X PUT localhost:3000/diet-plans/<plano>/meal-templates/<marmita> -H "Authorization: Bearer $T" -H 'Content-Type: application/json' -d '{"mealSlotId":"<almoco>","name":"Marmita","order":2,"kind":"FREE","items":[{"foodId":"<arroz>","grams":100}]}'` → 200 com `"id":"<marmita>"` e `totals.kcal` = `"130"`.
9. `curl -s -X DELETE localhost:3000/foods/<frango> -H "Authorization: Bearer $T"` → 204 (C19: nenhuma refeição modelo usa mais o frango).

Passo final (depois da 11b-2 ou da 11b-3):
10. `curl -s -X PATCH localhost:3000/diet-plans/<plano> -H "Authorization: Bearer $T" -H 'Content-Type: application/json' -d '{"mealSlots":[]}'` → 200 sem refeições; `curl -s localhost:3000/diet-plans/<plano>/meal-templates -H "Authorization: Bearer $T"` → `[]`. Se o frango ainda existe (validação parada na 11b-2), o `DELETE` do passo 5 agora dá 204.
