# Plano de risco: tarefa 10b — rendimento (FoodYield) e importação de alimentos por CSV

Aprovado por: humano, em 2026-11-12 (na conversa)
Revisão do plano: APROVADO em 2026-11-12 (2ª rodada; a 1ª pediu 9 ajustes, todos aplicados)

Entrega em **dois PRs** (regra 6: estimativa de ~380 linhas de produção somando as duas partes): **10b-1** rendimento (C1–C12) e **10b-2** CSV (C13–C24). Este arquivo fica até o PR da 10b-2, que o remove.

Decisões do humano (2026-11-11 e 2026-11-12), a gravar em `docs/domain.md` como A7–A9: no PR da 10b-1, A7 (rendimento, com fator, par único e rotas) e A8 (409 e travas); no PR da 10b-2, A9 (CSV):
- rendimento liga um alimento cru a um pronto, com fator = peso pronto ÷ peso cru;
- o rendimento é **próprio e privado** do usuário e pode ligar alimentos do catálogo e próprios;
- fator **> 0, até 2 casas decimais, sem teto de domínio**;
- **um rendimento por par** (cru, pronto) por usuário; o cru pode ter vários prontos;
- alimento em rendimento: `DELETE` e `PATCH` que troca `state` dão **409**;
- CSV **tudo ou nada**, até **500 linhas** de alimentos, importados são próprios; separador `;` ou `,`, detectado pelo cabeçalho; decimal com vírgula **ou** ponto nos dois modos (no modo `,` a vírgula decimal vem entre aspas, como o Google Planilhas em PT exporta) — decisão de 2026-11-12.

Decisões técnicas do agente (não mudam regra de negócio):
- coluna `factor` `Decimal(6,2)`: o maior valor guardável é 9999.99; acima disso, 400 (limite do tipo, não regra de domínio); devolvido como texto no formato do Prisma, como em A2 (`2.5` → `"2.5"`, `2.55` → `"2.55"`, sem zero final);
- FKs `FoodYield.userId`, `rawFoodId` e `cookedFoodId` em `RESTRICT` (padrão C3); a exclusão de conta (C1) apagará os rendimentos do usuário explicitamente, antes dos alimentos;
- **travas** (contra a corrida de C12 e o deadlock corrigido em 5f90832): o `POST /food-yields` roda numa transação que trava os dois alimentos **numa só consulta ordenada por `id`** (`SELECT ... WHERE id IN (...) ORDER BY id FOR SHARE`), confere visibilidade e `state` e cria; `DELETE /foods/:id` e o `PATCH` que muda `state` passam a rodar numa transação com `SELECT ... FOR UPDATE` do alimento antes de checar rendimentos (`FOR SHARE` não bloqueia dois rendimentos do mesmo alimento do catálogo entre si, mas conflita com o `FOR UPDATE`). Rede de segurança: P2002 no índice único vira o 409 de C5, e P2003 no `DELETE /foods` vira o 409 de C10;
- CSV por `multipart/form-data`, campo `file`, com o `FileInterceptor` do `@nestjs/platform-express` (multer 2.4.0 já vem com ele), armazenamento **em memória** (sem `dest` nem `storage` de disco), `limits: { fileSize: 262144, files: 1 }`; o arquivo é tipado localmente (`{ buffer: Buffer; size: number }`), **sem** `@types/multer` (seria dependência nova); parser próprio pequeno (RFC 4180: aspas, `""` e quebra de linha dentro de aspas), sem dependência nova;
- número da linha nos erros do CSV = **linha física do arquivo onde o registro começa** (cabeçalho = 1; linhas em branco e quebras dentro de aspas contam);
- número no CSV: só dígitos, com um separador decimal opcional (`,` ou `.`) seguido de dígitos; sem sinal, expoente, espaço, `Infinity` ou hexadecimal. Depois da conversão, valem as regras A2/A3 (1 casa, limites, soma). Célula vazia em coluna obrigatória dá 400 na linha (não vira `0`);
- teto de 256 KB no arquivo (500 linhas de ~100 bytes dão ~50 KB) → 413;
- o arquivo precisa ser UTF-8 (com ou sem BOM); "CSV" do Excel em Windows-1252 é recusado com mensagem para salvar como "CSV UTF-8".

## Critérios de aceite

Testes de rendimento em `test/food-yields.e2e-spec.ts`; de alimentos em `test/foods.e2e-spec.ts`; do parser em `src/foods/csv.spec.ts`.

### 10b-1: rendimento (`/food-yields`)
- [ ] C1: `POST /food-yields` `{ rawFoodId, cookedFoodId, factor: 2.5 }` com cru (`RAW`) e pronto (`COOKED`) visíveis ao usuário (catálogo ou próprios) → 201 `{ id, factor: "2.5", rawFood: { id, name }, cookedFood: { id, name }, createdAt, updatedAt }`, sem `userId` — teste: cria com cru do catálogo e pronto próprio; confere o corpo e a ausência de `userId`.
- [ ] C2: `rawFoodId` de alimento `COOKED` ou `cookedFoodId` de alimento `RAW` → 400 — teste: os dois casos.
- [ ] C3: `rawFoodId` ou `cookedFoodId` inexistente ou de outro usuário → 404 `"Alimento não encontrado"`, nada criado — teste: alheio e uuid inexistente, nas duas posições.
- [ ] C4: `factor` ausente, `0`, negativo, com 3 casas (`2.555`), texto ou `>= 10000` → 400; `0.01` e `9999.99` → 201 — teste: tabela de valores.
- [ ] C5: o mesmo usuário repete o par (cru, pronto) → 409 `"Rendimento já existe para este par"`; outro usuário com o mesmo par do catálogo → 201; o mesmo cru com outro pronto → 201; dois `POST` iguais ao mesmo tempo (`Promise.all`) → um 201 e um 409, nenhum 500 — teste: os quatro casos.
- [ ] C6: `GET /food-yields` → só os rendimentos do usuário, ordenados por nome do cru, depois do pronto, depois `id`; formato de C1; `GET /food-yields/:id` do próprio usuário → 200 no formato de C1 — teste: dois usuários, cada um vê só os seus; busca por id.
- [ ] C7: `PATCH /food-yields/:id` `{ factor }` → 200 com o fator novo; outros campos (`rawFoodId`, `cookedFoodId`, `userId`) → 400 (whitelist); fator inválido como em C4 → 400 — teste: troca o fator; tenta trocar `rawFoodId`.
- [ ] C8: `DELETE /food-yields/:id` → 204; depois o `GET` não o lista — teste.
- [ ] C9: `GET`, `PATCH` ou `DELETE` em `/food-yields/:id` de outro usuário ou inexistente → 404 `"Rendimento não encontrado"`; id que não é uuid → 400 — teste: os três verbos com rendimento alheio.
- [ ] C10: `DELETE /foods/:id` de alimento próprio que é cru ou pronto em algum rendimento → 409 `"Alimento em uso em rendimento"`, alimento continua; depois de apagar o rendimento → 204 (A6) — teste: nas duas posições.
- [ ] C11: `PATCH /foods/:id` que **muda** `state` de alimento em rendimento → 409 com a mesma mensagem, nada alterado; `PATCH` com o mesmo `state` ou só outros campos → 200 — teste: os três casos.
- [ ] C12: concorrência — 20 rodadas de `POST /food-yields` e `DELETE /foods/:id` (ou `PATCH` de `state`) do mesmo alimento ao mesmo tempo terminam sempre num estado válido: ou o rendimento existe e o alimento continua com o estado certo, ou o alimento mudou e não há rendimento; nenhuma resposta 500; e 20 rodadas de dois `POST /food-yields` com os ids invertidos (`raw=X, cooked=Y` e `raw=Y, cooked=X`, um deles recusado por `state`) terminam sem 500 nem deadlock — teste: `Promise.all` em laço. (Mecanismo nas decisões técnicas: travas ordenadas por `id`, FK `RESTRICT`, P2002/P2003 → 409.)
- [ ] Sem regressão: os testes atuais de `test/foods.e2e-spec.ts` continuam passando sem alteração.

### 10b-2: importação por CSV (`POST /foods/import`)
- [ ] C13: arquivo EN (`name,state,kcal,proteinG,carbsG,fatG,fiberG,tags`, ponto decimal) com 3 linhas válidas → 201 `{ "imported": 3 }`; os 3 aparecem no `GET /foods` como próprios do usuário, com os valores do arquivo — teste.
- [ ] C14: o mesmo conteúdo em padrão BR (`;` e `12,5`), com BOM UTF-8 e quebras `\r\n` → 201 com os mesmos valores — teste.
- [ ] C15: colunas em qualquer ordem; `fiberG` e `tags` podem faltar no cabeçalho ou vir vazias (`null` e `[]`); `tags` separadas por `|` (`VEGAN|GLUTEN_FREE`); nome com separador ou aspas entre aspas (`"Arroz, integral"`, `"Pão ""francês"""`) → importado com o texto certo — teste: unidade no parser e um caso e2e.
- [ ] C16: cada linha passa pelas regras A2 e A3 (as mesmas do `POST /foods`). Uma linha inválida no meio de 10 → 400 com `errors: [{ line, message }]` (linha física onde o registro começa, cabeçalho = 1), e **nenhum** alimento criado; célula vazia em `kcal` (ou outra coluna obrigatória) → 400 na linha, não `0` — teste: conta os alimentos antes e depois; caso da célula vazia.
- [ ] C17: várias linhas inválidas → todas listadas em `errors`, cada uma com o número da linha — teste.
- [ ] C18: cabeçalho sem coluna obrigatória (`name`, `state`, `kcal`, `proteinG`, `carbsG`, `fatG`), com coluna desconhecida ou repetida → 400 nomeando a coluna — teste.
- [ ] C19: linha com número de campos diferente do cabeçalho, ou aspas sem fechar → 400 com o número da linha; nome entre aspas com quebra de linha dentro é aceito, e o erro de um registro seguinte cita a linha física certa (ex.: registro que começa na linha 4 depois de um nome de 2 linhas na linha 2) — teste: unidade no parser e um caso e2e.
- [ ] C20: arquivo vazio, só com cabeçalho ou sem campo `file` → 400; linhas em branco são ignoradas — teste.
- [ ] C21: 500 linhas de alimentos → 201 `{ "imported": 500 }`; 501 → 400 `"Máximo de 500 alimentos por arquivo"` e nada criado — teste.
- [ ] C22: arquivo acima de 256 KB → 413; arquivo que não é UTF-8 válido (ex.: `Feijão` em Windows-1252) → 400 `"Arquivo precisa estar em UTF-8 (no Excel: salvar como CSV UTF-8)"` — teste.
- [ ] C23: nos dois modos, decimal com vírgula ou ponto é aceito (`12,5` e `12.5` → `"12.5"`); no modo `,`, `"4,8"` entre aspas (exportação do Google Planilhas em PT) → `"4.8"`; `1e2`, `-1`, ` 12 `, `0x10`, `Infinity` e `1.2.3` → 400 na linha — teste: unidade no parser e um caso e2e com arquivo no formato do Google.
- [ ] C24: sem token → 401; o `userId` vem só do token (coluna `userId` no arquivo → 400 de coluna desconhecida) — teste.

Fora de escopo: uso do rendimento na lista de compras (tarefa da Fase 3); rendimentos do catálogo; exportar alimentos em CSV; importar rendimentos por CSV; importação inteira da TACO; detectar ou fundir nomes repetidos (A5 permite); paginação de `/food-yields`; a rota de exclusão de conta (C1 só ganha a nota de que apaga os rendimentos). Nota para o futuro: uma carga ou correção do catálogo que apague um alimento do catálogo ou troque seu `state` passa a ser barrada pelos rendimentos privados de qualquer usuário (FK `RESTRICT`); isso vai como uma linha em A7.

## Risco
- **Zona tocada:** `prisma/schema.prisma` e `prisma/migrations/` (tabela nova `food_yields`, sem mexer nas existentes), `src/foods/` (regra nova em `DELETE` e `PATCH`), entrada externa (arquivo CSV).
- **Como desfazer:** 10b-1: num **mesmo PR e mesmo deploy**, `git revert <sha>` do código **e** uma migration nova `DROP TABLE food_yields` (não editar a existente; as migrations rodam no start, ADR 0010). Só reverter o código deixaria a FK `RESTRICT` ativa sem a checagem de 409, e o `DELETE /foods` de alimento com rendimento daria 500. O `DROP` **apaga os rendimentos criados desde o deploy**; para guardá-los, exportar antes (`COPY food_yields TO ...`). A migration da ida só cria a tabela e não altera dado existente. 10b-2: sem migration; reverter o PR basta, e os alimentos importados ficam como alimentos comuns.
- **Pré-mortem:**
  - corrida entre criar rendimento e apagar ou mudar o alimento deixa rendimento com cru que virou `COOKED`, ou responde 500 → C12 (FK `RESTRICT`, travas ordenadas, P2002/P2003 → 409);
  - `DELETE /foods/:id` deixa de ser `findFirst` + `deleteMany` solto e passa a rodar em transação com trava: muda o padrão da rota, coberto pelos testes atuais de `foods.e2e-spec.ts`, que continuam sem alteração;
  - alimento do catálogo em rendimento de vários usuários: `FOR SHARE` não os enfileira entre si; só o `FOR UPDATE` de `DELETE`/`PATCH` espera;
  - CSV grande ou malicioso trava o processo → teto de 256 KB no multer e 500 linhas, antes de validar;
  - Excel em PT salva Windows-1252 e acentos viram lixo gravado → C22 recusa;
  - erro de digitação no fator (250 no lugar de 2.5) passa, por decisão do humano (sem teto); fica visível e editável pelo `PATCH`;
  - importação parcial deixaria a base pela metade → `createMany` numa só instrução (atômica) + `CHECK` A3 no banco como última barreira; C16 prova que nada é criado.
- **Segurança** (skill `seguranca`, seções "Em todo tipo de trabalho" e "API"):
  - *Autorização por objeto:* aplica-se. Rendimento filtrado por `userId` do token em toda rota; alimentos do rendimento precisam ser do catálogo ou do usuário. Verificado por C3, C6 e C9.
  - *Atribuição em massa:* aplica-se. DTOs com whitelist; `userId` nunca do body nem do arquivo. Verificado por C7 e C24.
  - *Entrada externa e limites:* aplica-se (CSV). Tamanho (256 KB), linhas (500), codificação, colunas e validação A2/A3 por linha. Verificado por C16–C23.
  - *Exposição de dados:* aplica-se. Respostas sem `userId`; erros do CSV citam linha e campo, sem eco do arquivo inteiro. Verificado por C1 e C16.
  - *Falha segura:* aplica-se. Qualquer erro no CSV recusa o arquivo inteiro (C16); erro de banco inesperado vira 500 sem gravar nada (transação).
  - *Injeção:* consultas pelo Prisma, parametrizadas; injeção de fórmula em CSV só importa na exportação, que está fora de escopo.
  - *Autenticação e sessão, segredos, SSRF, autorização por função:* não se aplicam (sem mudança em `src/auth/`, sem segredo novo, sem URL de usuário, sem papel administrativo).
  - *Dependências:* não se aplica (nenhuma nova; `multer` já vem com `@nestjs/platform-express`, conferido em `node_modules/@nestjs/platform-express/package.json`).
  - *Modelo de ameaças:* ativos = base de alimentos e rendimentos de cada usuário. Ameaças: usuário autenticado lê ou altera dado de outro (mitigação: filtro por `userId`, C9); envia arquivo enorme ou malformado para derrubar a API (mitigação: limites antes do parse, C21 e C22); grava dado fora das regras pelo CSV (mitigação: mesmas validações do `POST` + `CHECK` no banco, C16).
- **Dependências novas:** Nenhuma.

## Validação do humano
Com o app no ar (`docker compose up -d`, `npx prisma migrate deploy`, `npm run start:dev`) e um token de `POST /auth/login` em `$T`:

1. Crie um cru e um pronto e ligue os dois:
   `curl -s -X POST localhost:3000/foods -H "Authorization: Bearer $T" -H 'Content-Type: application/json' -d '{"name":"Arroz cru","state":"RAW","kcal":360,"proteinG":7,"carbsG":79,"fatG":0.6}'` (anote o `id`); repita com `"Arroz cozido","state":"COOKED","kcal":130,...`.
   `curl -s -X POST localhost:3000/food-yields -H "Authorization: Bearer $T" -H 'Content-Type: application/json' -d '{"rawFoodId":"<cru>","cookedFoodId":"<pronto>","factor":2.5}'` → 201 com `"factor":"2.5"`.
2. `curl -s -o /dev/null -w '%{http_code}' -X DELETE localhost:3000/foods/<cru> -H "Authorization: Bearer $T"` → `409`.
3. Monte uma planilha com as colunas `name`, `state`, `kcal`, `proteinG`, `carbsG`, `fatG`, `fiberG`, `tags` e duas linhas (ex.: `Feijão cozido`, `COOKED`, `76`, `4,8`, `13,6`, `0,5`, `8,5`, `VEGAN`). Exporte no **Excel** como "CSV UTF-8" (sai com `;`) e no **Google Planilhas** em "Arquivo > Fazer download > CSV" (sai com `,` e `"4,8"` entre aspas). Envie cada um:
   `curl -s -X POST localhost:3000/foods/import -H "Authorization: Bearer $T" -F file=@alimentos.csv` → `{"imported":2}`; confira no `GET /foods?search=feij` que o acento e o `"4.8"` estão certos.
4. Estrague uma linha (ex.: `kcal` 1000) e envie de novo → 400 com o número da linha, e o `GET /foods` não ganhou nenhum alimento.
