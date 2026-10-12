# Domínio — exactafit-api

> Fonte da verdade para regras de negócio. Agentes **não devem presumir** regras que não estão aqui; na dúvida, perguntar.
> As regras foram extraídas do código da `main` (`0ad9004`) e revisadas pelo humano em 2026-10-12.
>
> **Status das regras:**
> - `CONFIRMADO`: o humano validou o comportamento atual do código.
> - `DECIDIDO (muda o código)`: o humano decidiu algo diferente do que o código faz hoje. Ver "Mudanças de código decorrentes".
> - `ADIADO`: a decisão foi explicitamente adiada.
> - `CONFIRMAR(humano)`: regra ainda não validada.

## Visão do produto
- Uso pessoal por ora.
- `TODO(humano)`: quem usa, que problema resolve, o que está fora do produto. Ver também "Decisões pendentes" em [`architecture.md`](architecture.md#decisões-pendentes).

## Glossário
| Termo | Definição | Nome no código |
|---|---|---|
| Usuário | `TODO(humano)` | `User` |
| Exercício | Item do catálogo oficial (global, somente leitura, vindo do dataset) ou criado pelo usuário (pertence só a ele). | `Exercise` |
| Catálogo oficial | Conjunto global e somente leitura de exercícios vindo do dataset. | não existe |
| Ficha de treino | `TODO(humano)`. Uma ficha é arquivada, nunca apagada. Uma ficha vazia é permitida como rascunho. | `WorkoutRoutine` |
| Item da ficha | `TODO(humano)` | `RoutineItem` |
| Sessão de treino | `TODO(humano)`. Fica aberta enquanto `finishedAt` estiver vazio. | `WorkoutSession` |
| Série registrada | `TODO(humano)` | `SetLog` |
| Série falhada | Série em que não completei as repetições planejadas. | `SetLog.failed` |
| Carga | Peso em kg. | `SetLog.weightKg` |
| Grupo muscular | Valor de uma lista fechada derivada do dataset. Valores: `TODO(humano)`. | `Exercise.muscleGroup` |
| Tipo de exercício | Valor de uma lista fechada derivada do dataset. Valores: `TODO(humano)`. | `Exercise.type` |

## Regras de negócio

### Usuários e acesso
| # | Regra | Onde | Status |
|---|---|---|---|
| U1 | O e-mail é único e **normalizado** (trim + minúsculas) antes de gravar e de comparar. Hoje o código não normaliza. Cadastro com e-mail existente → 409. | `auth.service.ts`, DTOs | `DECIDIDO (muda o código)` |
| U2 | Nome obrigatório, até 100 caracteres. E-mail válido, até 255. | `register.dto.ts` | `CONFIRMAR(humano)` |
| U3 | Senha com **mínimo de 8** caracteres (hoje o código exige 6). O máximo de 72 (limite do bcrypt) continua `CONFIRMAR(humano)`. | `register.dto.ts`, `login.dto.ts` | `DECIDIDO (muda o código)` |
| U4 | A senha é guardada como hash bcrypt (custo 10) e nunca volta na resposta do cadastro. | `auth.service.ts` `create` | `CONFIRMAR(humano)` |
| U5 | Login com e-mail inexistente ou senha errada dá a mesma resposta: 401 `"Credenciais inválidas"`. | `auth.service.ts` `login` | `CONFIRMAR(humano)` |
| U6 | O token é um JWT com `sub` = id do usuário e `email`, válido por 7 dias, sem refresh nem revogação. A decisão sobre expiração e refresh fica para a fase do front. | `auth.module.ts`, `auth.service.ts` | `ADIADO` |
| U7 | Não existem papéis: todo usuário autenticado tem as mesmas permissões. | ausência no código | `CONFIRMAR(humano)` |
| U8 | A aplicação não sobe sem `JWT_SECRET` (hoje usa um segredo fixo de reserva). | `auth.module.ts` | `DECIDIDO (muda o código)` |

### Exercícios
| # | Regra | Onde | Status |
|---|---|---|---|
| E1 | O catálogo oficial é global e **somente leitura**, vindo do dataset. Um exercício criado por usuário pertence só a ele. Hoje nenhum exercício tem dono e todos veem todos. **Implementação adiada** (uso pessoal por ora): o código atual permanece como está. Ver [ADR 0003](adr/0003-catalogo-oficial-e-exercicios-do-usuario.md). | `schema.prisma`, `exercises.service.ts` | `DECIDIDO (muda o código)` |
| E2 | Qualquer usuário autenticado pode criar exercícios, que pertencem só a ele (hoje entram no catálogo de todos). A edição e a remoção de exercícios não foram decididas: `TODO(humano)`. | `exercises.controller.ts` | `DECIDIDO (muda o código)` |
| E3 | `name` obrigatório, até 100 caracteres. | `create-exercises.dto.ts` | `CONFIRMAR(humano)` |
| E4 | `muscleGroup` e `type` aceitam só valores de uma lista fechada derivada do dataset (hoje são texto livre, e `type` tem padrão `strength`). Valores e padrão: `TODO(humano)`, a definir depois de inspecionar o dataset. | `create-exercises.dto.ts`, `schema.prisma` | `DECIDIDO (muda o código)` |
| E5 | Nomes duplicados são permitidos. | ausência de `@unique` | `CONFIRMAR(humano)` |
| E6 | Um exercício com séries registradas não pode ser apagado. Ver [ADR 0001](adr/0001-exclusao-sem-cascata-de-historico.md). | `schema.prisma` (hoje cascade) | `DECIDIDO (muda o código)` |

### Fichas de treino
| # | Regra | Onde | Status |
|---|---|---|---|
| F1 | Uma ficha pertence ao usuário do token. Um usuário só lista, lê e altera as próprias fichas. A ficha de outro usuário responde 404. | `routine.service.ts` | `CONFIRMAR(humano)` |
| F2 | Nome obrigatório, até 100 caracteres. Descrição opcional, até 255. | `create-routine.dto.ts` | `CONFIRMAR(humano)` |
| F3 | Ficha sem itens é permitida, como rascunho. `TODO(humano)`: "rascunho" é um estado explícito ou só uma ficha sem itens? | `create-routine.dto.ts` | `CONFIRMADO` |
| F4 | `targetSets` de 1 a 20, `targetReps` de 1 a 100, `order` ≥ 0 (hoje qualquer inteiro passa). | `create-routine.dto.ts` | `DECIDIDO (muda o código)` |
| F5 | O mesmo exercício pode aparecer mais de uma vez na ficha, desde que o `order` seja único. | ausência de constraint | `CONFIRMADO` |
| F6 | O item precisa referenciar um exercício existente. Hoje isso é garantido só pela FK. | `schema.prisma` | `CONFIRMAR(humano)` |
| F7 | Os itens são devolvidos em ordem crescente de `order`, com os dados do exercício. | `routine.service.ts` | `CONFIRMAR(humano)` |
| F8 | A atualização é parcial. Se `items` vier, substitui todos os itens, que ganham ids novos. Isso é aceitável porque o histórico (`SetLog`) guarda o `exerciseId` e não depende dos itens da ficha. | `routine.service.ts` `update` | `CONFIRMADO` |
| F9 | A ficha é **arquivada**, nunca apagada. Hoje não há exclusão nem arquivamento. `TODO(humano)`: se a ficha arquivada aparece nas listagens e se pode ser editada. Ver [ADR 0001](adr/0001-exclusao-sem-cascata-de-historico.md). | `schema.prisma`, `routine.*` | `DECIDIDO (muda o código)` |
| F10 | Não há limite de fichas por usuário nem de itens por ficha. | ausência no código | `CONFIRMAR(humano)` |
| F11 | O `order` é único dentro da ficha (hoje pode repetir). `TODO(humano)`: se precisa ser sequencial, sem lacunas. | `create-routine.dto.ts`, `schema.prisma` | `DECIDIDO (muda o código)` |

### Sessões e séries (só schema; nenhum código usa ainda)
| # | Regra | Onde | Status |
|---|---|---|---|
| S1 | Uma sessão pertence a um usuário e a uma ficha. O início é registrado automaticamente (`now()`). | `schema.prisma` `WorkoutSession` | `CONFIRMAR(humano)` |
| S2 | A sessão tem `finishedAt` opcional: vazio significa sessão aberta. Hoje o campo não existe. | `schema.prisma` | `DECIDIDO (muda o código)` |
| S3 | Cada usuário tem no máximo uma sessão aberta. | — | `DECIDIDO (muda o código)` |
| S4 | Ficha sem itens não pode iniciar sessão. | — | `DECIDIDO (muda o código)` |
| S5 | Uma série registrada tem `setNumber`, `repsCompleted`, `failed` (padrão `false`) e referencia um exercício. | `schema.prisma` `SetLog` | `CONFIRMAR(humano)` |
| S6 | `failed` = série em que não completei as repetições planejadas. `TODO(humano)`: se o valor é informado pelo usuário ou calculado. Ver [ADR 0002](adr/0002-definicao-de-serie-falhada.md). | `SetLog.failed` | `CONFIRMADO` (significado) |
| S7 | A carga é em kg, decimal com precisão fixa (exemplo dado: 6,2). Hoje é `Float`. | `SetLog.weightKg` | `DECIDIDO (muda o código)` |
| S8 | O banco não impede série duplicada (mesma sessão, exercício e número) nem série de exercício fora da ficha. | ausência de constraint | `CONFIRMAR(humano)` |

### Exclusão (ver [ADR 0001](adr/0001-exclusao-sem-cascata-de-historico.md))
| # | Regra | Status |
|---|---|---|
| C1 | Apagar um usuário apaga as fichas, sessões e séries dele (cascade). `TODO(humano)`: a decisão "nunca apagar histórico em cascata" vale também para a exclusão de usuário? | `CONFIRMAR(humano)` |
| C2 | Histórico (sessões e séries) nunca é apagado em cascata. Fichas são arquivadas (F9). Hoje apagar uma ficha apaga as sessões e séries dela. | `DECIDIDO (muda o código)` |
| C3 | Um exercício com séries registradas não pode ser apagado (E6). Hoje o cascade apaga as séries de todos os usuários. `TODO(humano)`: o que acontece com um exercício que só aparece em itens de ficha. | `DECIDIDO (muda o código)` |

### Progressão e métricas
- O código não faz nenhum cálculo (volume, 1RM, progressão). `TODO(humano)`.
- Fuso horário: datas em `TIMESTAMP(3)` sem fuso. `TODO(humano)`.

## Invariantes (devem sempre ser verdade)
- Um usuário nunca lê nem altera a ficha de outro usuário (F1). `CONFIRMAR(humano)`
- A senha nunca é devolvida em resposta da API (U4). `CONFIRMAR(humano)`
- Histórico de sessões e séries nunca é apagado em cascata (C2). `DECIDIDO`
- Cada usuário tem no máximo uma sessão aberta (S3). `DECIDIDO`
- O `order` é único dentro de cada ficha (F11). `DECIDIDO`

## Casos de borda conhecidos (comportamento atual, não verificado em execução)
- `PUT /routine/:id` com `"name": null` passa na validação e falha no banco (provável 500).
- `exerciseId` inexistente em `POST` ou `PUT /routine` gera erro de FK não tratado (provável 500).
- Dois cadastros simultâneos com o mesmo e-mail: um deles provavelmente recebe 500 em vez de 409.
- `Joao@x.com` e `joao@x.com` são contas diferentes (deixa de valer com U1).

## Mudanças de código decorrentes
Nada disso está implementado. Cada item precisa de plano (`docs/PLAN_TEMPLATE.md`) aprovado antes.

| Regras | O que muda | Risco |
|---|---|---|
| U1 | Normalizar o e-mail (trim + minúsculas) no cadastro e no login, por exemplo com `@Transform` no DTO ou no service. Antes de mudar, verificar se o banco já tem e-mails que colidem depois de normalizados. | **Médio**: toca `src/auth/`; dados existentes podem colidir. |
| U3 | `@MinLength(8)` em `register.dto.ts`. `TODO(humano)`: aplicar também em `login.dto.ts`? Se aplicar, usuários com senha de 6–7 caracteres deixam de conseguir entrar. | **Médio**: toca `src/auth/`; pode bloquear contas existentes. |
| U8 | Adicionar `dotenv` como dependência direta no `package.json`. Remover o fallback fixo em `auth.module.ts` e falhar na inicialização sem `JWT_SECRET`. Em tarefa própria, com plano. Forma de deploy: `TODO(humano)`. | **Médio**: toca `package.json` e `src/auth/`; quebra ambientes sem a variável. |
| E1, E2 | Schema: dono opcional em `Exercise` (nulo = catálogo oficial) + migration. Filtrar `GET /exercises` (oficiais + do usuário) e gravar `userId` no `POST`. Bloquear escrita no catálogo oficial. **Adiado.** | **Médio**: schema, migration e todas as consultas de exercício. |
| E4 | Lista fechada para `muscleGroup` e `type`: enum no schema ou validação `@IsIn` no DTO, a decidir no plano. Migration se for enum. Depende dos valores do dataset (`TODO(humano)`). | **Médio**: dados existentes fora da lista quebram a migration. |
| E6, C2, C3 | Schema: trocar `onDelete: Cascade` por `Restrict` nas FKs de histórico (`SetLog.exerciseId` e `WorkoutSession.routineId`) + migration. `TODO(humano)`: `SetLog.sessionId`, `RoutineItem.exerciseId` e as FKs de `User`. | **Médio**: migration em FK; muda o comportamento de exclusão. |
| F9 | Schema: campo de arquivamento em `WorkoutRoutine` (nome e tipo a definir no plano) + migration. Endpoint de arquivar e efeito nas listagens: `TODO(humano)`. | **Baixo**: coluna nova opcional. |
| F4 | `@Min`/`@Max` em `CreateRoutineItemDto`: `targetSets` 1–20, `targetReps` 1–100, `order` ≥ 0. | **Baixo**: só validação. Requisições que hoje passam começam a receber 400. |
| F11 | Validar unicidade de `order` no DTO/service e criar constraint única (`routineId`, `order`) + migration. | **Médio**: a migration falha se já houver `order` repetido no banco. |
| S2 | Schema: `finishedAt DateTime?` em `WorkoutSession` + migration. | **Baixo**: coluna nova opcional; nenhum código usa sessões ainda. |
| S3 | Garantir uma sessão aberta por usuário: checagem no service dentro de transação e/ou índice único parcial em SQL na migration, a decidir no plano. | **Médio**: concorrência; o Prisma não modela índice parcial no schema. |
| S4 | Ao iniciar sessão, rejeitar ficha sem itens. Depende do módulo `sessions` (`wip/sessions`). | **Baixo**. |
| S7 | Schema: `weightKg` de `Float` para `Decimal` com precisão fixa + migration. Precisão final: `TODO(humano)` (exemplo dado: 6,2). | **Baixo**: nenhum código usa `SetLog` ainda; o tipo `Decimal` muda a serialização no JSON. |
