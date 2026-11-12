# Plano de risco: tarefa 11a — estrutura do plano de dieta (`DietPlan`, refeições, tipos de dia e metas)

Aprovado por: humano, em 2026-11-12 (na conversa)
Revisão do plano: APROVADO em 2026-11-12 (2ª rodada; a 1ª pediu 9 ajustes, todos aplicados)

A tarefa 11 de `docs/produto.md` foi dividida: **11a** (este plano) cobre a estrutura do plano e as metas; **11b** (`MealTemplate`, refeição modelo com componentes) terá plano próprio, porque tem perguntas de domínio só dela. A 11a sai em **dois PRs** (regra 6; estimativa de ~350 linhas de produção somando as partes): **11a-1** criar, ler, apagar, ativar (C1–C14) e **11a-2** editar com `PATCH` (C15–C21). Este arquivo fica até o PR da 11a-2, que o remove.

## Decisões do humano (2026-11-12)
Gravadas em `docs/domain.md` no PR da 11a-1, numa seção nova "Plano de dieta" com as regras D1–D8. O PR também **reescreve a seção (c)** (hoje ela dá a entender que as quatro metas são obrigatórias), atualiza o glossário (`DietPlan (a criar)`) e acrescenta à C1 que a exclusão de conta apaga os planos de dieta.
- **D1.** **Tipos de dia livres**, com nome dado pelo usuário, por plano (ex.: "Treino", "Descanso", "Refeed"); plano de meta única tem um só tipo.
- **D2.** **Meta do dia obrigatória** em cada tipo de dia; **meta por refeição opcional**; a API **não** exige que as refeições somem o dia, só devolve a soma.
- **D3.** Numa meta, **kcal, proteína, carboidrato, gordura e fibra são todos opcionais, mas pelo menos um** é obrigatório.
- **D4.** **Sem teto de negócio**: valores ≥ 0, até 1 casa decimal (como A2), dentro do limite da coluna; sem teto de quantidade de planos, refeições ou tipos de dia (como o programa).
- **D5.** **Qual tipo vale no dia vem do treino do programa**: o plano diz qual tipo vale em dia **com treino** e qual em dia **sem treino** (podem ser o mesmo). A escolha do dia em si e a troca manual ficam para a tarefa 15.
- **D6.** **Vários planos por usuário, um ativo**: ativar um desativa os outros; `deactivate` deixa o usuário sem ativo; apagar o ativo também deixa sem ativo.
- **D7.** O usuário **pode apagar** o plano; refeições, tipos de dia e metas saem junto. O histórico de refeições (tarefa 13) guarda snapshot e não depende do plano.
- **D8.** **Plano sem refeições é permitido** (só metas do dia); o plano sempre tem pelo menos um tipo de dia.

Já decidido antes (domain.md (c) e produto.md §5): metas de kcal, proteína, carboidrato e gordura, fibra opcional; a tela Hoje usa "o plano ativo".

## Decisões técnicas do agente (não mudam regra de negócio)
- **Nomes:** o `DayTarget` do `produto.md` vira duas tabelas: `DayType` (o tipo de dia, que guarda a meta do dia) e `MealTarget` (a meta da refeição dentro do tipo de dia; na API, `mealTargets`). O glossário do `domain.md` registra o mapeamento.
- Tabelas: `diet_plans` (`id`, `user_id` FK `RESTRICT`, `name`, `active`, timestamps), `meal_slots` (`diet_plan_id` FK `CASCADE`, `name`, `order`), `day_types` (`diet_plan_id` FK `CASCADE`, `name`, `order`, `training_day` e `rest_day` booleanos, valores da meta do dia), `meal_targets` (`day_type_id` FK `CASCADE`, `meal_slot_id` FK `CASCADE`, valores; único por par).
- Valores (`kcal`, `proteinG`, `carbsG`, `fatG`, `fiberG`) como `Decimal(6,1)`: de 0 a 99999.9, até 1 casa (acima ou com 2 casas, 400); devolvidos como texto no formato do Prisma, como em A2 (`"2400"`, `"12.5"`); `null` num valor de meta equivale a omitir.
- `name` (plano, refeição, tipo): 1 a 100 caracteres, sem byte nulo (`NO_NUL`, como o programa).
- `order` (refeição e tipo) e as referências `trainingDayTypeOrder`, `restDayTypeOrder` e `mealSlotOrder`: inteiro de 0 a 2147483647 (int4), como R6. O `order` é único entre as refeições do plano e entre os tipos do plano; lacunas permitidas.
- No corpo, as referências entre partes são **pela posição `order`** no estado final do plano.
- Exatamente um tipo marcado como dia com treino e um como dia sem treino (podem ser o mesmo), guardado nas colunas `training_day` e `rest_day`, garantido no service, como o "um ativo" do programa.
- Ordem na resposta: refeições e tipos por `order`; `mealTargets` de cada tipo pela `order` da refeição.
- **Ativação** igual à do programa (tarefa 7a, com a correção de 5f90832): transação que trava a linha do usuário (`FOR NO KEY UPDATE`). A ativação do plano de dieta e a do programa do mesmo usuário passam a esperar uma pela outra, o que é inofensivo.
- **Edição (11a-2)**: transação que trava a linha do plano (`SELECT … FOR UPDATE`, como o `update` do programa) antes de ler e gravar. Cada item enviado em `mealSlots` ou `dayTypes` é o **estado completo** do item: com `id`, mantém o id e substitui nome, `order` e valores (valor omitido grava `null`; `mealTargets` substitui todas as metas do tipo; `mealTargets` omitida = nenhuma meta); sem `id`, é criado; item atual que não veio é apagado com suas metas. Ids estáveis porque a 11b vai pendurar refeições modelo nas refeições.
- Teto do corpo da requisição: o padrão do Express (100 KB → 413), conferido no C14.

## Critérios de aceite

Testes em `test/diet-plans.e2e-spec.ts`.

### 11a-1: criar, ler, apagar e ativar (`/diet-plans`)
- [ ] C1: `POST /diet-plans` com `name`, 4 refeições (`mealSlots: [{ name, order }]`), 1 tipo de dia (`dayTypes: [{ name, order, kcal: 1900, proteinG: 140, mealTargets: [{ mealSlotOrder, kcal }] }]` com 340/615/310/615) e `trainingDayTypeOrder` = `restDayTypeOrder` = o tipo → 201 com `{ id, name, active: false, trainingDayTypeId, restDayTypeId, mealSlots: [{ id, name, order }], dayTypes: [{ id, name, order, kcal: "1900", proteinG: "140", carbsG: null, fatG: null, fiberG: null, mealTargets: [{ mealSlotId, kcal: "340", proteinG: null, carbsG: null, fatG: null, fiberG: null }, …], mealTargetsSum: { kcal: "1880", proteinG: null, carbsG: null, fatG: null, fiberG: null } }], createdAt, updatedAt }`, sem `userId`; refeições e tipos por `order`, `mealTargets` pela `order` da refeição (o teste manda as metas fora de ordem) — teste: o caso do modelo B; confere o corpo, a ordem e a soma.
- [ ] C2: plano com 2 tipos ("Treino" 2400 kcal, "Descanso" 2100 kcal), sem refeições → 201; `trainingDayTypeId` e `restDayTypeId` apontam para os tipos certos — teste.
- [ ] C3: meta (do dia ou da refeição) sem nenhum dos cinco valores, valor negativo, com 2 casas, acima de 99999.9 ou texto → 400, nada gravado; 0 e 99999.9 → 201 — teste: tabela de valores.
- [ ] C4: `mealTargetsSum` soma, campo a campo, só as metas de refeição que têm o campo; campo que nenhuma tem → `null`; tipo sem metas de refeição → todos `null` — teste: metas mistas (uma com kcal e proteína, outra só com kcal).
- [ ] C5: estrutura inválida → 400, nada gravado: `dayTypes` vazio ou ausente; `order` repetido entre refeições ou entre tipos; `trainingDayTypeOrder` ou `restDayTypeOrder` ausente ou que não existe; `mealSlotOrder` que não existe; duas metas para a mesma refeição no mesmo tipo; `name` vazio, com mais de 100 caracteres ou com `\u0000` (plano, refeição ou tipo); `order` ou uma das três referências negativa, fracionária ou acima de 2147483647 — teste: um caso por item.
- [ ] C6: `active`, `userId` ou campo desconhecido no corpo → 400 (whitelist) — teste.
- [ ] C7: `GET /diet-plans` → só os planos do usuário, por `name` e `id`, no formato de C1 — teste: dois usuários.
- [ ] C8: `GET /diet-plans/:id` do próprio → 200 no formato de C1 — teste.
- [ ] C9: plano de outro usuário ou inexistente → 404 `"Plano de dieta não encontrado"` em `GET`, `DELETE`, `activate` e `deactivate` (e no `PATCH`, na 11a-2); id que não é uuid → 400 — teste.
- [ ] C10: `DELETE /diet-plans/:id` → 204; refeições, tipos e metas saem junto (contagem no banco = 0) — teste.
- [ ] C11: `POST /diet-plans/:id/activate` → 200 com `active: true`, e os outros planos do usuário passam a `false`; planos de outro usuário não mudam — teste.
- [ ] C12: `POST /diet-plans/:id/deactivate` → 200 com `active: false` e usuário sem ativo; apagar o ativo deixa sem ativo — teste.
- [ ] C13: 10 rodadas de `activate` de dois planos do mesmo usuário ao mesmo tempo → no fim, exatamente um ativo; nenhum 500 nem deadlock — teste: `Promise.all` em laço.
- [ ] C14: sem token → 401 em todas as rotas; corpo acima de 100 KB → 413 — teste.

### 11a-2: editar (`PATCH /diet-plans/:id`)
- [ ] C15: `PATCH` só com `name` → 200, estrutura igual (mesmos ids e valores) — teste.
- [ ] C16: `PATCH` com `mealSlots` e `dayTypes`: itens com `id` mantêm o id e passam a ter exatamente o que veio (valor omitido vira `null`; `mealTargets` substitui as metas do tipo; sem `mealTargets`, o tipo fica sem metas de refeição); itens sem `id` são criados; os que faltam são apagados com suas metas — teste: renomeia uma refeição, cria uma, apaga outra; tipo enviado sem `proteinG` fica com `proteinG: null`; confere ids e contagem no banco.
- [ ] C17: `id` que não é deste plano (de outro plano do mesmo usuário, de outro usuário ou inexistente), `id` repetido na mesma lista, ou `id` de tipo de dia em `mealSlots` (e o inverso) → 400, nada alterado — teste: um caso por item.
- [ ] C18: o estado final passa pelas mesmas regras de C3 e C5; as referências por `order` valem no estado final; erro → 400 e nada alterado — teste: três casos (meta vazia, `order` repetido, `mealSlotOrder` que não existe).
- [ ] C19: `trainingDayTypeOrder` e `restDayTypeOrder` no `PATCH` trocam os tipos marcados; omitidos, continuam nos mesmos tipos (pelo id); se `dayTypes` veio sem o tipo marcado e o campo não veio → 400 — teste.
- [ ] C20: `null` em `name`, `mealSlots`, `dayTypes`, `trainingDayTypeOrder` ou `restDayTypeOrder` → 400; `active` no `PATCH` → 400; editar o plano ativo mantém `active: true` — teste.
- [ ] C21: 10 rodadas de dois `PATCH` ao mesmo tempo no mesmo plano (um apaga uma refeição, o outro a renomeia pelo `id`), e de `PATCH` com `DELETE` → nenhum 500; no fim o plano obedece C5 (um tipo com treino e um sem treino) ou foi apagado (404) — teste: `Promise.all` em laço.

Fora de escopo: refeições modelo e componentes (11b), **inclusive o que acontece com elas quando a edição apaga a refeição** (a 11b decide a FK; hoje `meal_slots` só tem filhos em `CASCADE`); cálculo da porção (12); registro de refeição (13); qual tipo vale hoje e a troca manual (15); assistente de metas a partir do perfil; modelos A e B como dado (14); compartilhar plano no household (16); exportar e importar plano em JSON; a rota de exclusão de conta (C1 só ganha a nota de que apaga os planos de dieta).

## Risco
- **Zona tocada:** `prisma/schema.prisma` e `prisma/migrations/` (4 tabelas novas; nenhuma existente muda). Dados de saúde (metas de dieta) do usuário.
- **Como desfazer:** 11a-1: num **mesmo PR e mesmo deploy**, `git revert` do código **e** uma migration nova que apaga as 4 tabelas (`meal_targets`, `day_types`, `meal_slots`, `diet_plans`, nessa ordem). Os planos criados desde o deploy se perdem; a perda é aceita porque a API não está em produção (U8). Se for preciso guardá-los: `pg_dump --data-only -t diet_plans -t meal_slots -t day_types -t meal_targets "$DATABASE_URL" > planos.sql`. Como nenhuma tabela existente ganha FK nova apontando para elas, reverter só o código não quebra rota antiga. **Se a 11b já estiver no ar com FK para `meal_slots`, reverter a 11b primeiro.** 11a-2: sem migration; reverter o PR basta.
- **Pré-mortem:**
  - dois `activate` ao mesmo tempo deixam dois planos ativos → C13 (trava da linha do usuário, como o programa);
  - dois `PATCH`, ou `PATCH` e `DELETE`, ao mesmo tempo: um atualiza uma refeição que o outro apagou (P2025 → 500) ou ficam dois tipos marcados como dia com treino → trava da linha do plano no `PATCH` (C21);
  - escrita em 4 tabelas falha no meio e deixa plano sem tipo de dia → `prisma.$transaction` em `POST` e `PATCH`; C5 e C18 conferem "nada gravado";
  - edição troca ids e quebra o que a 11b pendurar nas refeições → ids estáveis (C16);
  - corpo enorme sem teto de quantidade → 413 do Express em 100 KB (C14);
  - nome com byte nulo chega ao Postgres e vira 500 → `NO_NUL` (C5);
  - um usuário lê metas de outro → filtro por `userId` em toda query (C7, C9).
- **Segurança** (skill `seguranca`, seções "Em todo tipo de trabalho" e "API"):
  - *Autorização por objeto:* aplica-se (dados de saúde privados, produto §1). Toda rota filtra por `userId` do token; ids de refeição e tipo no `PATCH` só valem se forem deste plano e da lista certa. Verificado por C7, C9 e C17.
  - *Atribuição em massa:* aplica-se. Whitelist; `active` e `userId` no corpo dão 400. Verificado por C6 e C20.
  - *Entrada e limites:* aplica-se. Valores ≥ 0, 1 casa, ≤ 99999.9; nomes até 100 e sem byte nulo; `order` no int4; corpo até 100 KB. Verificado por C3, C5 e C14.
  - *Exposição de dados:* aplica-se. Resposta sem `userId`. Verificado por C1.
  - *Falha segura:* aplica-se. Transação: erro no meio não grava nada (C5, C18); corrida não vira 500 (C13, C21).
  - *Autenticação e sessão, segredos, SSRF, autorização por função, injeção:* não se aplicam (sem mudança em `src/auth/`, sem segredo, sem URL de usuário, sem papel; consultas pelo Prisma).
  - *Dependências:* não se aplica (nenhuma nova).
  - *Modelo de ameaças:* ativo = metas de dieta (dado de saúde). Ameaça: usuário autenticado lê ou altera plano de outro, ou pendura no seu plano uma refeição de outro plano (mitigação: filtro por `userId` e checagem de que os ids são do plano e da lista; C9, C17). Ameaça: corpo gigante para gastar memória (mitigação: 413 em 100 KB; C14).
- **Dependências novas:** Nenhuma.

## Validação do humano
Com o app no ar (`docker compose up -d`, `npx prisma migrate deploy`, `npm run start:dev`), crie um usuário (`curl -s -X POST localhost:3000/auth/register -H 'Content-Type: application/json' -d '{"name":"Teste","email":"dieta@example.com","password":"password123"}'`) e guarde o token do login em `$T` (`T=$(curl -s -X POST localhost:3000/auth/login -H 'Content-Type: application/json' -d '{"email":"dieta@example.com","password":"password123"}' | sed 's/.*"accessToken":"\([^"]*\)".*/\1/')`).

1. Crie o plano do modelo B:
   `curl -s -X POST localhost:3000/diet-plans -H "Authorization: Bearer $T" -H 'Content-Type: application/json' -d '{"name":"Recomposição","mealSlots":[{"name":"Café","order":1},{"name":"Almoço","order":2},{"name":"Lanche","order":3},{"name":"Jantar","order":4}],"dayTypes":[{"name":"Todos os dias","order":1,"kcal":1900,"proteinG":140,"mealTargets":[{"mealSlotOrder":1,"kcal":340},{"mealSlotOrder":2,"kcal":615},{"mealSlotOrder":3,"kcal":310},{"mealSlotOrder":4,"kcal":615}]}],"trainingDayTypeOrder":1,"restDayTypeOrder":1}'` → 201 com `"kcal":"1900"` no dia e `"mealTargetsSum":{"kcal":"1880",…}`. Anote o `id` do plano (`<plano>`), o `id` de cada refeição (`<cafe>`, `<almoco>`, `<lanche>`, `<jantar>`) e o do tipo (`<tipo>`); eles também aparecem em `curl -s localhost:3000/diet-plans/<plano> -H "Authorization: Bearer $T"`.
2. `curl -s -X POST localhost:3000/diet-plans/<plano>/activate -H "Authorization: Bearer $T"` → `"active":true`.
3. (Depois da 11a-2) Renomeie o lanche mantendo o id:
   `curl -s -X PATCH localhost:3000/diet-plans/<plano> -H "Authorization: Bearer $T" -H 'Content-Type: application/json' -d '{"mealSlots":[{"id":"<cafe>","name":"Café","order":1},{"id":"<almoco>","name":"Almoço","order":2},{"id":"<lanche>","name":"Lanche da tarde","order":3},{"id":"<jantar>","name":"Jantar","order":4}],"dayTypes":[{"id":"<tipo>","name":"Todos os dias","order":1,"kcal":1900,"proteinG":140,"mealTargets":[{"mealSlotOrder":1,"kcal":340},{"mealSlotOrder":2,"kcal":615},{"mealSlotOrder":3,"kcal":310},{"mealSlotOrder":4,"kcal":615}]}]}'` → 200; a refeição `"Lanche da tarde"` tem o mesmo `id` `<lanche>`, e o plano continua `"active":true`.
