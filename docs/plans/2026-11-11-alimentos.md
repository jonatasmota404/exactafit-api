# Plano de risco: alimentos (tarefa 10a)

> Só risco alto. Descartável: o essencial vai para a descrição do PR e este arquivo é removido (`git rm`) no mesmo PR.

Aprovado por: humano em 2026-11-11 (pontos 1–4 confirmados)
Revisão do plano: APROVADO em 2026-11-11 (revisor-de-plano, 2ª rodada)

Tarefa 10 de `docs/produto.md`, dividida pela regra 6 (~300 linhas): **10a** (este plano) é o alimento (`Food`) e `/foods`; **10b** (plano próprio, depois) é o rendimento (`FoodYield`) e a importação por CSV. Regra: decisão (c) de `docs/domain.md`.

## Decisões do humano (2026-11-11)
- **Dono:** catálogo comum, só leitura (`userId` nulo), mais alimentos próprios e privados de cada usuário, como nos exercícios (E1, E2). Compartilhar com o household fica para a tarefa 16.
- **Nutrientes por 100 g:** kcal, proteína, carboidrato e gordura obrigatórios; fibra opcional. A kcal é a informada, não calculada.
- **Limites:** kcal de 0 a 900; proteína, carboidrato, gordura e fibra de 0 a 100 g; soma de proteína + carboidrato + gordura + fibra até 100 g; até 1 casa decimal; nome até 100 caracteres.
- **Tags de restrição:** lista fixa `GLUTEN_FREE`, `LACTOSE_FREE`, `VEGAN`, `VEGETARIAN`.
- **Rendimento (10b):** liga um alimento cru a um pronto, com um fator.
- **CSV (10b):** tudo ou nada; os importados são próprios do usuário.
- **Apagar:** o dono apaga o próprio alimento se não estiver em uso (o uso em rendimento entra na 10b com 409); o catálogo não se edita nem se apaga pela API.

## Regras propostas (entram em `docs/domain.md` como A1–A6, nova seção "Alimentos", no mesmo PR)
- **A1, dono:** `Food.userId` nulo = catálogo; preenchido = próprio e privado. `GET` devolve catálogo + próprios; alimento de outro usuário dá 404 em qualquer rota.
- **A2, campos:** `name` (1 a 100 caracteres, sem byte nulo), `state` (`RAW` cru ou `COOKED` pronto, obrigatório), `kcal`, `proteinG`, `carbsG`, `fatG` (obrigatórios), `fiberG` (opcional, nulo), `tags` (lista de valores únicos da lista fixa; padrão vazia). Valores com até 1 casa decimal, guardados como `Decimal` e devolvidos como texto (`"12.5"`, `"0"`), no padrão de `weightKg` das séries.
- **A3, limites:** os da decisão do humano. A soma vale para o estado final: no `PATCH`, os campos omitidos entram com o valor gravado. A soma é comparada sem erro de arredondamento (em décimos inteiros), para que uma soma exata de 100 nunca seja recusada (em ponto flutuante, 0 + 3.9 + 64.9 + 31.2 dá `100.00000000000001`). O banco também garante a regra com um `CHECK` (`protein_g + carbs_g + fat_g + coalesce(fiber_g, 0) <= 100`).
- **A4, rotas:**
  - `GET /foods`: catálogo + próprios, ordenados por `name` e depois `id`. Filtros opcionais: `search` (texto de 1 a 100 caracteres, sem byte nulo, um só; o nome contém o texto, sem diferenciar maiúsculas; acentos contam), `state` (um só) e `tag` (um ou mais, `tag=A` ou `tag=A&tag=B`; o alimento precisa ter todas). Filtro inválido ou repetido onde só cabe um → 400. Sem paginação.
  - `GET /foods/:id`, `POST /foods` (cria próprio; `userId` do token), `PATCH /foods/:id` (parcial; responde 200 com o mesmo formato de C1; `fiberG: null` limpa; `tags: []` limpa as tags; `null` em `name`, `state`, `tags` e nos nutrientes obrigatórios dá 400), `DELETE /foods/:id` (204).
  - `PATCH` e `DELETE` em alimento do catálogo: 403 `"Alimento do catálogo não pode ser alterado"`. Em alimento de outro usuário ou inexistente: 404 `"Alimento não encontrado"`.
- **A5, nomes repetidos:** permitidos, como nos exercícios (E5).
- **A6, exclusão:** apaga o próprio alimento; a partir da 10b, alimento em rendimento dá 409. O histórico de refeições (tarefa 13) guarda snapshot, então não depende do alimento.

**Documentação no mesmo PR:** `docs/domain.md` ganha A1–A6; a linha C3 (Exclusão) ganha `Food.userId` `RESTRICT`; a linha C1 (exclusão de conta) passa a apagar também os alimentos próprios, explicitamente, como já diz para `Exercise.userId`; `docs/produto.md`, linha da tarefa 10, registra a divisão em 10a e 10b e marca a 10a como feita.

## Critérios de aceite
- [ ] C1: `POST /foods` com os campos válidos → 201 com `{ id, name, state, kcal, proteinG, carbsG, fatG, fiberG, tags, createdAt, updatedAt }`, valores numéricos como texto (`12.5` → `"12.5"`), sem `userId` do body; `fiberG` e `tags` omitidos voltam `null` e `[]` — teste: "cria próprio" em `test/foods.e2e-spec.ts`
- [ ] C2: validação no `POST` → 400 e nada gravado, para cada caso: `name` vazio, com 101 caracteres ou com byte nulo; `state` fora de `RAW`/`COOKED` ou ausente; cada nutriente obrigatório ausente, `null`, negativo, texto (`"10"`) ou com 2 casas (`10.25`); `kcal` 900.1; `proteinG` 100.1; soma 100.1 (ex.: P 50, C 50, G 0, fibra 0.1); `tags` com valor fora da lista, repetido ou que não é lista; campo desconhecido (`userId`). Bordas aceitas (201): `kcal` 0 e 900; um macro 100 com os outros 0; soma exatamente 100 com casas decimais (P 0, C 3.9, G 64.9, fibra 31.2); `12.3`; `name` com 100 caracteres; as 4 tags juntas — teste: tabela "validação" em `test/foods.e2e-spec.ts`
- [ ] C3: `GET /foods` devolve o catálogo e os próprios do usuário, e não os de outro usuário; ordem por nome (o teste usa nomes ASCII com primeira letra diferente, para não depender da collation) — teste: "lista catálogo + próprios" em `test/foods.e2e-spec.ts`
- [ ] C4: filtros: `search=arroz` acha "Arroz branco" e "ARROZ integral" e não acha "Feijão"; `state=COOKED` só prontos; `tag=VEGAN` sozinho só os que têm VEGAN; `tag=VEGAN&tag=GLUTEN_FREE` só os que têm as duas; `state` ou `tag` fora da lista → 400; `search` com byte nulo (`%00`), com 101 caracteres ou repetido (`search=a&search=b`) → 400; `state` repetido → 400 — teste: "filtros" em `test/foods.e2e-spec.ts`
- [ ] C5: `GET /foods/:id` → 200 para catálogo e próprio; 404 para o de outro usuário e para inexistente; `:id` fora do formato UUID → 400 — teste: "busca por id" em `test/foods.e2e-spec.ts`
- [ ] C6: `PATCH /foods/:id` parcial: só `kcal` muda só a kcal; `fiberG: null` limpa a fibra; `tags: []` limpa as tags; `name: null`, `state: null`, `tags: null` ou `kcal: null` → 400 e nada muda; a soma usa os valores gravados (alimento com P 60 gravado, `PATCH { carbsG: 41 }` → 400 e nada muda; alimento com P 0, G 64.9 e fibra 31.2 gravados, `PATCH { carbsG: 3.9 }` → 200); `PATCH` válido devolve 200 com o formato de C1 — teste: "edita parcial" em `test/foods.e2e-spec.ts`
- [ ] C7: `PATCH` e `DELETE` em alimento do catálogo → 403 `"Alimento do catálogo não pode ser alterado"` e o catálogo não muda; em alimento de outro usuário → 404 e nada muda — teste: "catálogo e alheio" em `test/foods.e2e-spec.ts`
- [ ] C8: `DELETE /foods/:id` do próprio → 204; depois, `GET /foods/:id` → 404 e ele some da lista — teste: "apaga próprio" em `test/foods.e2e-spec.ts`
- [ ] C9: sem token, todas as rotas de `/foods` → 401 — teste: "sem token" em `test/foods.e2e-spec.ts`
- [ ] C10: a migration só cria (`CREATE TYPE` dos enums e `CREATE TABLE foods` com FK `user_id` → `users` `RESTRICT` e o `CHECK` da soma); nenhuma tabela existente muda — prova por comando no Postgres local, colada no PR:
  1. `docker exec treino_postgres psql -U postgres -d exactafitdb -Atc "SELECT count(*) FROM users"` antes e depois do `npx prisma migrate deploy` → mesmo número;
  2. `npx prisma migrate diff --from-config-datasource --to-schema prisma/schema.prisma --exit-code` → "No difference detected.", exit 0;
  3. o `CHECK` existe: `docker exec treino_postgres psql -U postgres -d exactafitdb -Atc "SELECT count(*) FROM pg_constraint WHERE conrelid = 'foods'::regclass AND contype = 'c'"` → `1`.

Fora de escopo: `FoodYield` e importação por CSV (10b); carga do catálogo de alimentos (quais e quantos, a decidir como a P1 dos exercícios); compartilhar alimento no household (16); paginação; busca sem acento; outros nutrientes (sódio, açúcar); porção (12); impedir apagar alimento usado em plano ou refeição modelo (11).

## Risco
- **Zona tocada:** `prisma/schema.prisma`, `prisma/migrations/<novo>_alimentos`. Arquivos novos em `src/foods/` (módulo, controller, service, DTOs) e registro em `src/app.module.ts`.
- **Estimativa:** ~250 linhas de produção.
- **Como desfazer:** antes do merge, fechar o PR. Depois do merge, um PR que reverte o código e acrescenta a migration inversa, nesta ordem:
  1. `DROP TABLE foods;`
  2. `DROP TYPE "FoodTag"; DROP TYPE "FoodState";`

  Perde só os alimentos cadastrados; nada depende deles ainda.
- **Pré-mortem:**
  - Usuário vê ou altera alimento de outro: coberto por C3, C5 e C7 (toda consulta filtra por `userId` ou catálogo).
  - Alguém altera o catálogo pela API: coberto por C7.
  - 500 por entrada estranha (byte nulo, número enorme, lista vazia de tags): coberto por C2; sondas do revisor.
  - Lista sem paginação fica lenta com catálogo grande: aceito agora; o tamanho do catálogo ainda não foi decidido.
  - Dois `PATCH` simultâneos do mesmo dono, cada um válido sozinho, somariam mais de 100: o `CHECK` do banco recusa o segundo (ele dá 500, caso raro e só do próprio dono); o dado nunca fica inválido.
  - Alimento com kcal ou macro 0 dá divisão por zero no cálculo da porção: não afeta a 10a; anotar para a tarefa 12.
- **Segurança (skill `seguranca`, tipo API):**
  - **Autorização / IDOR:** aplica-se. Rotas com `:id` filtram por dono ou catálogo; alheio dá 404 (C5, C7); `userId` nunca vem do body (C1, C2).
  - **Entrada externa:** aplica-se. DTO com whitelist; limites e formato (C2, C6); filtros de query validados (C4).
  - **Autenticação:** aplica-se só o `AuthGuard` existente (C9).
  - **Dados pessoais:** não se aplica: alimento não é dado de saúde do usuário. A dieta e o registro (tarefas 11 e 13) são.
  - **Segredos:** não se aplica: nada novo.
  - **Dependências:** não se aplica: nenhuma nova.
  - **Modelo de ameaças curto:**
    - *Ativos:* o catálogo comum; os alimentos próprios de cada usuário.
    - *Quem ataca:* outro usuário autenticado.
    - *O que pode dar errado:* ler, mudar ou apagar alimento alheio; mudar o catálogo de todos; derrubar a rota com entrada inválida.
    - *Mitigação:* filtro por dono em toda consulta (C3, C5, C7); catálogo só leitura (C7); validação do corpo e da query (C2, C4, C6); `CHECK` no banco para a soma.
- **Dependências novas:** Nenhuma.

## Pontos para confirmar na aprovação
1. `PATCH`/`DELETE` em alimento do catálogo dá **403** (o usuário vê o alimento, então 404 confundiria); alheio dá 404.
2. Nomes repetidos são permitidos (como E5). Na 10b, reimportar o mesmo CSV vai duplicar os alimentos.
3. A busca diferencia acentos (`feijao` não acha `Feijão`) e aceita até 100 caracteres.
4. A carga do catálogo de alimentos fica fora desta tarefa: até lá, o catálogo está vazio e só existem os próprios.

## Validação do humano
Com o app no ar (`docker compose up -d`, `npx prisma migrate deploy` e `npm run start:dev`) e um token de login:
1. `POST /foods` com `{"name":"Arroz branco cozido","state":"COOKED","kcal":128,"proteinG":2.5,"carbsG":28.1,"fatG":0.2,"fiberG":1.6,"tags":["VEGAN","GLUTEN_FREE"]}` → 201 com `"kcal":"128"` e `"proteinG":"2.5"`. Anote o `id`.
2. `GET /foods?search=arroz&tag=VEGAN` → a lista traz o alimento do passo 1.
3. `PATCH /foods/<id>` com `{"carbsG":98}` → 400 (soma passa de 100 g).
4. `PATCH /foods/<id>` com `{"fiberG":null}` → 200 com `"fiberG":null`.
5. `DELETE /foods/<id>` → 204; `GET /foods/<id>` → 404.

- [ ] Rodei o comportamento e ele faz o que os critérios pedem.
