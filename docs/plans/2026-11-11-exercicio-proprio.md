# Plano de risco: exercício próprio e privado (tarefa 4)

> Só risco alto. Descartável: o essencial vai para a descrição do PR e este arquivo é removido (`git rm`) no mesmo PR.

Aprovado por: humano em 2026-11-11 (na conversa: "aprovado")
Revisão do plano: APROVADO em 2026-11-11 (revisor-de-plano, 2ª rodada; a 1ª pediu 6 ajustes, todos aplicados)

Tarefa 4 de `docs/produto.md`. Regras: E1, E2 e F6 de `docs/domain.md`, mais o trecho de S8 que ficou da tarefa 3 ("exercício visível ao usuário"). ADR de base: [ADR 0011](../adr/0011-app-generico-plano-e-dado.md).

**Decisões do humano (2026-11-11):**
1. Esta tarefa só **cria e lista** exercício próprio. Editar e apagar o próprio viram tarefa separada.
2. Os exercícios que já existem no banco ficam **sem dono**, ou seja, viram **catálogo**. A API não está em produção (U8), então são só dados de desenvolvimento e de teste.

**Decisões técnicas (agente):**
1. `Exercise.userId` é opcional: nulo é catálogo. A FK para `User` é `RESTRICT`, como as demais de C3. A exclusão de conta (C1) apaga os exercícios próprios explicitamente, numa tarefa futura.
2. O índice em `user_id` serve à listagem.
3. Exercício inexistente e exercício de outro usuário dão **a mesma resposta**, para não revelar que o id existe:
   - no item de ficha (F6): 400 `"Exercício não encontrado"`;
   - na série (S8): 404 `"Exercício não encontrado"`, que é o mesmo status da tarefa 3 para exercício inexistente.
4. F6, "qual item falhou na mensagem" (estava `ADIADO`): a mensagem **não indica o item**. É a forma mais simples, e o app sabe quais exercícios enviou. Indicar o item pode vir depois sem quebrar o contrato.

## Critérios de aceite
Testes novos em `test/exercises.e2e-spec.ts`, salvo indicação.

**Criar e listar exercício**
- [ ] C1 (E2): `POST /exercises` grava o exercício com `userId` = usuário do token e responde 201 com `userId` no corpo. `userId` no body dá 400 e nada é gravado. — teste: "POST cria exercício próprio"
- [ ] C2 (E1, E2): `GET /exercises` do usuário A devolve os exercícios de catálogo (`userId` nulo) e os próprios de A. Nenhum exercício de B aparece, e nenhum `userId` diferente de nulo ou de A aparece na resposta. — teste: "GET lista catálogo + próprios"

**Item de ficha (F6)**
- [ ] C3: `POST /routine` com item de exercício de outro usuário dá 400 `"Exercício não encontrado"` e nenhuma ficha é gravada. Com exercício inexistente, também 400 (hoje dá 500). Com exercício de catálogo ou próprio, 201. Ficha com o mesmo exercício (catálogo ou próprio) em dois itens de `order` diferente (F5) também dá 201. — teste: "F6 no POST /routine" em `test/routines.e2e-spec.ts`
- [ ] C4: `PUT /routine/:id` com item de exercício de outro usuário ou inexistente dá 400 `"Exercício não encontrado"`, e a ficha e os itens continuam iguais. Com exercício de catálogo ou próprio, 200, inclusive com o mesmo exercício repetido em dois itens. — teste: "F6 no PUT /routine" em `test/routines.e2e-spec.ts`

**Série (S8)**
- [ ] C5: `POST /sessions/:id/sets` com exercício próprio de outro usuário dá 404 `"Exercício não encontrado"` e nada é gravado. Com exercício de catálogo ou próprio, 201. — teste: "série com exercício de outro usuário" em `test/sessions.e2e-spec.ts`

**Banco e migration**
- [ ] C6 (C3): apagar no banco um usuário que tem exercício próprio é recusado (`P2003`), e o exercício continua lá. — teste: "dono com exercício próprio não sai em cascata"
- [ ] C7 (migration): depois de `npx prisma migrate deploy`, todo exercício que já existia fica com `user_id` nulo. As contagens de `exercises`, `routine_items` e `set_logs` não mudam. — verificação no banco local de desenvolvimento, com as saídas no PR:
  - **Antes:** `docker exec treino_postgres psql -U postgres -d exactafitdb -c "SELECT (SELECT count(*) FROM exercises) ex, (SELECT count(*) FROM routine_items) ri, (SELECT count(*) FROM set_logs) sl;"`
  - **Depois:** o mesmo comando, com as mesmas três contagens.
  - **Dono:** `docker exec treino_postgres psql -U postgres -d exactafitdb -c "SELECT count(*) FROM exercises WHERE user_id IS NOT NULL;"` deve dar `0`.
  - O `migrate deploy` pede a confirmação do humano (zona de risco do `AGENTS.md`).

**Testes de caracterização alterados** (`Teste alterado: <motivo>` no commit, passando a afirmar o comportamento novo):
- `test/exercises-caracterizacao.e2e-spec.ts`: no caso "E1/E2: exercício criado pelo usuário A aparece na listagem do usuário B":
  - passa a afirmar que **não** aparece;
  - `not.toHaveProperty('userId')` se inverte: o corpo tem `userId` igual ao de A (C1).
- `test/routines-caracterizacao.e2e-spec.ts`:
  - os dois casos "F6 … falha com 500" agora afirmam 400;
  - no caso "F6/E1: aceita item com exercício criado por outro usuário", o **setup** muda: o exercício passa a ser criado com `userId` = A (hoje é criado pelo Prisma sem dono, e depois da tarefa seria catálogo). Usado por B, dá 400. O caso com exercício de catálogo continua 201.
- **Limpeza dos testes:**
  - Os `afterAll` de `test/sessions.e2e-spec.ts`, `test/sessions-caracterizacao.e2e-spec.ts` e `test/routines-caracterizacao.e2e-spec.ts` apagam usuários antes de exercícios.
  - Com a FK `RESTRICT` do C6, isso falharia sempre que o arquivo criar exercício próprio.
  - Os exercícios próprios passam a ser apagados antes dos usuários. É mudança só de limpeza, sem tirar nenhuma verificação.

**Atualizações em `docs/domain.md` no mesmo PR:**
- **E1 e E2:** marcar como implementado, tirar "Hoje nenhum exercício tem dono…" e registrar a decisão 1 do humano (editar e apagar o próprio ficam para tarefa separada).
- **F6:** implementado, e a mensagem não indica o item (decisão técnica 4).
- **S8:** tirar "(visibilidade por dono: tarefa 4)" e dizer que exercício de outro usuário dá 404.
- **C3:** a FK `Exercise.userId` é `RESTRICT`.
- **Linha E1 (`Exercise.userId`) de "Mudanças de código decorrentes":** os exercícios existentes viram catálogo (decisão 2 do humano).

**Fora de escopo:**
- Editar e apagar exercício próprio (decisão 1 do humano).
- E4: lista fechada de `muscleGroup` e remoção de `type`.
- Carga do catálogo (tarefa 5, P1).
- `GET /exercises/:id`.
- Paginação e ordem da listagem.
- FKs `WorkoutRoutine.userId` e `RoutineItem.exerciseId` (tarefa 6).
- Fluxo de exclusão de conta (C1).

## Risco
- **Zona tocada:** `prisma/schema.prisma` e `prisma/migrations/`, numa migration nova que só adiciona a coluna `user_id` (nula), a FK e o índice. O código fica em `src/exercises/`, `src/routines/` e `src/sessions/`. `src/auth/` não é tocado.
- **Como desfazer:**
  - **Antes do merge:** fechar o PR.
  - **Depois do merge:** um PR de reversão que faz duas coisas juntas:
    - **Código:** reverte `src/`, `prisma/schema.prisma` e os testes, **mantendo** a pasta da migration desta tarefa. Não é `git revert` do merge inteiro, porque ele apagaria do repositório uma migration já aplicada.
    - **Banco:** acrescenta uma migration nova que remove o índice, a FK e a coluna `user_id`. Isso não perde dado de treino, mas apaga a informação de dono, e os exercícios próprios viram catálogo, ou seja, ficam visíveis a todos.
  - Nunca editar nem apagar a migration aplicada.
- **Pré-mortem:**
  1. **Um caminho que aceita `exerciseId` fica sem a checagem**, e um usuário referencia o exercício privado de outro. Inventário feito por `git grep -n exerciseId src/`: `routine.service.ts` (create e update) e `sessions.service.ts` (createSet). Os três ganham critério (C3, C4 e C5). O revisor repete o grep.
  2. **A listagem vaza `userId` de outro usuário.** C2 confere que nenhum `userId` estranho aparece na resposta.
  3. **A migration falha no banco de produção futuro.** Não há produção (U8). A coluna é nula e não tem valor padrão, então não reescreve linhas.
  4. **A limpeza dos testes quebra com a FK `RESTRICT`.** Arquivos que criam exercício próprio e apagam o usuário antes dele falham no `afterAll`. O inventário está em "Testes de caracterização alterados > Limpeza". Hoje só `exercises-caracterizacao` cria exercício por `POST /exercises`; os outros testes usam o Prisma direto, sem dono.
  5. **`GET /routine` passa a mostrar o `userId` do exercício de cada item.** Só alcança catálogo (nulo) ou exercício do próprio usuário, porque os existentes viram catálogo e as escritas ficam filtradas.
- **Segurança** (skill `seguranca`, seção API do checklist):
  - **Autorização por objeto (BOLA/IDOR): se aplica.** O exercício próprio é objeto privado, e toda query que lê ou referencia exercício filtra por "catálogo ou dono = usuário do token". Verificado por C2, C3, C4 e C5, com usuário B tentando usar o exercício de A, e pelo grep do pré-mortem 1 refeito pelo revisor.
  - **Autorização por propriedade (mass assignment): se aplica.** `userId` no body do `POST /exercises` dá 400 pelo `forbidNonWhitelisted`, e o dono vem só do token. Verificado por C1.
  - **Fluxos sensíveis contra automação em massa: não se aplica agora.** Criar exercício não é fluxo sensível. Um limite de quantidade não foi pedido e é decisão de domínio.
  - **Inventário de rotas: se aplica.** Nenhuma rota nova. Não há `PUT` nem `DELETE /exercises/:id`, e isso continua coberto pelo teste de caracterização "não há PUT nem DELETE".
  - **Consumo de API externa: não se aplica**, porque não há.
  - **Modelo de ameaças curto:**

    | | |
    |---|---|
    | Ativo | O exercício próprio do usuário. É pouco sensível, mas é privado por decisão (E1). |
    | Quem ataca | Outro usuário autenticado, com um id de exercício obtido por palpite ou vazamento. |
    | O que pode dar errado | Listar, usar em ficha ou registrar série com o exercício de outro usuário, ou descobrir que um id existe pela diferença de resposta. |
    | Mitigação | Filtro por dono em todas as consultas (C2 a C5). Resposta igual para "não existe" e "é de outro usuário". UUID aleatório. |

  - **ADR: não é necessário.** A decisão de ter exercício próprio e privado já está no ADR 0011. A coluna nula é reversível por migration.
- **Dependências novas:** nenhuma.

## Validação do humano
Com o app no ar (`docker compose up -d`, `npx prisma migrate deploy`, `npm run start:dev`):

1. Crie dois usuários (A e B) por `POST /auth/register` e `POST /auth/login`.
2. Com o token de A, faça `POST /exercises` com `{"name":"Meu supino","muscleGroup":"chest"}`.
   - **Esperado:** 201 com `userId` de A.
3. `GET /exercises` com o token de B.
   - **Esperado:** "Meu supino" **não** aparece.
4. `GET /exercises` com o token de A.
   - **Esperado:** aparece.
5. Com o token de B, faça `POST /routine` com um item usando o id do "Meu supino" de A.
   - **Esperado:** 400 `"Exercício não encontrado"`.
6. Com o token de A, a mesma ficha.
   - **Esperado:** 201.
