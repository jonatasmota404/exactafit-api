# Domínio — exactafit-api

> Fonte da verdade para regras de negócio. Agentes **não devem presumir** regras que não estão aqui; na dúvida, perguntar.
> As regras abaixo foram **extraídas do código** da `main` (`0ad9004`) em 2026-10-12. Elas descrevem o que o código faz hoje, não o que deveria fazer. Cada uma está marcada `CONFIRMAR(humano)` até ser validada. Perguntas em aberto: `docs/architecture.md` → "Perguntas em aberto".

## Visão do produto
- `TODO(humano)`: quem usa, que problema resolve, o que está fora do produto.

## Glossário
| Termo | Definição (inferida do código) | Nome no código |
|---|---|---|
| Usuário | Conta com nome, e-mail e senha. | `User` |
| Exercício | Item de um catálogo global: nome, grupo muscular e tipo. | `Exercise` |
| Ficha de treino | Plano de treino nomeado que pertence a um usuário. | `WorkoutRoutine` |
| Item da ficha | Exercício planejado na ficha, com posição (`order`), séries-alvo e repetições-alvo. | `RoutineItem` |
| Sessão de treino | Execução de uma ficha por um usuário, com horário de início. Só existe no schema. | `WorkoutSession` |
| Série registrada | Série executada numa sessão: número, carga em kg, repetições feitas e se falhou. Só existe no schema. | `SetLog` |
| Grupo muscular | Texto livre. | `Exercise.muscleGroup` |
| Tipo de exercício | Texto livre, padrão `strength`. | `Exercise.type` |

`TODO(humano)`: confirmar ou corrigir cada definição.

## Regras de negócio

### Usuários e acesso
| # | Regra (como o código faz hoje) | Onde | Status |
|---|---|---|---|
| U1 | O e-mail é único. Cadastro com e-mail existente → 409 `"E-mail já cadastrado"`. A comparação diferencia maiúsculas de minúsculas. | `auth.service.ts` `create`, `schema.prisma` `@unique` | `CONFIRMAR(humano)` |
| U2 | Nome obrigatório, até 100 caracteres. E-mail válido, até 255. | `register.dto.ts` | `CONFIRMAR(humano)` |
| U3 | Senha de 6 a 72 caracteres, sem regra de complexidade. O máximo de 72 é o limite do bcrypt. | `register.dto.ts`, `login.dto.ts` | `CONFIRMAR(humano)` |
| U4 | A senha é guardada como hash bcrypt (custo 10) e nunca volta na resposta do cadastro. | `auth.service.ts` `create` | `CONFIRMAR(humano)` |
| U5 | Login com e-mail inexistente ou senha errada dá a mesma resposta: 401 `"Credenciais inválidas"`. | `auth.service.ts` `login` | `CONFIRMAR(humano)` |
| U6 | O token de acesso é um JWT com `sub` = id do usuário e `email`, válido por 7 dias, sem refresh nem revogação. | `auth.module.ts`, `auth.service.ts` | `CONFIRMAR(humano)` |
| U7 | Não existem papéis: todo usuário autenticado tem as mesmas permissões. | ausência no código | `CONFIRMAR(humano)` |

### Exercícios
| # | Regra | Onde | Status |
|---|---|---|---|
| E1 | O catálogo é global: exercícios não têm dono e todos os usuários veem todos. | `schema.prisma`, `exercises.service.ts` `list` | `CONFIRMAR(humano)` |
| E2 | Qualquer usuário autenticado pode criar exercícios. Não existe edição nem remoção pela API. | `exercises.controller.ts` | `CONFIRMAR(humano)` |
| E3 | `name` e `muscleGroup` são obrigatórios, até 100 caracteres, em texto livre. | `create-exercises.dto.ts` | `CONFIRMAR(humano)` |
| E4 | `type` é opcional, até 100 caracteres, texto livre. O padrão é `strength`. | `create-exercises.dto.ts`, `schema.prisma` | `CONFIRMAR(humano)` |
| E5 | Nomes duplicados são permitidos. | ausência de `@unique` | `CONFIRMAR(humano)` |

### Fichas de treino
| # | Regra | Onde | Status |
|---|---|---|---|
| F1 | Uma ficha pertence ao usuário do token. Um usuário só lista, lê e altera as próprias fichas. A ficha de outro usuário responde 404, igual a uma inexistente. | `routine.service.ts` `findAll`, `findOne`, `update` | `CONFIRMAR(humano)` |
| F2 | Nome obrigatório, até 100 caracteres. Descrição opcional, até 255. | `create-routine.dto.ts` | `CONFIRMAR(humano)` |
| F3 | Na criação, `items` é obrigatório mas pode ser lista vazia. | `create-routine.dto.ts` | `CONFIRMAR(humano)` |
| F4 | `order`, `targetSets` e `targetReps` são inteiros, sem mínimo nem máximo: zero e negativos passam. | `create-routine.dto.ts` | `CONFIRMAR(humano)` |
| F5 | `order` não precisa ser único nem sequencial. O mesmo exercício pode aparecer várias vezes. | ausência de validação/constraint | `CONFIRMAR(humano)` |
| F6 | O item precisa referenciar um exercício existente. Isso é garantido só pela FK, sem mensagem de negócio. | `schema.prisma` | `CONFIRMAR(humano)` |
| F7 | Os itens são sempre devolvidos em ordem crescente de `order`, com os dados do exercício. | `routine.service.ts` | `CONFIRMAR(humano)` |
| F8 | A atualização é parcial: só muda o que vier no body. Se `items` vier, **substitui todos** os itens (os anteriores são apagados e os ids mudam), de forma atômica. | `routine.service.ts` `update` | `CONFIRMAR(humano)` |
| F9 | Não existe exclusão de ficha pela API. | `routine.controller.ts` | `CONFIRMAR(humano)` |
| F10 | Não há limite de fichas por usuário nem de itens por ficha. | ausência no código | `CONFIRMAR(humano)` |

### Sessões e séries (só schema; nenhum código usa ainda)
| # | Regra | Onde | Status |
|---|---|---|---|
| S1 | Uma sessão pertence a um usuário e a uma ficha. O início é registrado automaticamente (`now()`). | `schema.prisma` `WorkoutSession` | `CONFIRMAR(humano)` |
| S2 | A sessão não tem fim nem estado (aberta/encerrada). | `schema.prisma` | `CONFIRMAR(humano)` |
| S3 | Uma série registrada tem `setNumber`, `weightKg` (decimal em ponto flutuante), `repsCompleted` e `failed` (padrão `false`), e referencia um exercício. | `schema.prisma` `SetLog` | `CONFIRMAR(humano)` |
| S4 | O banco não impede série duplicada (mesma sessão, exercício e número) nem série de exercício que não está na ficha. | ausência de constraint | `CONFIRMAR(humano)` |
| S5 | A unidade de carga é kg. | nome do campo `weightKg` | `CONFIRMAR(humano)` |

### Exclusão em cascata (todas as FKs)
| # | Regra | Status |
|---|---|---|
| C1 | Apagar um usuário apaga as fichas, sessões e séries dele. | `CONFIRMAR(humano)` |
| C2 | Apagar uma ficha apaga os itens **e as sessões e séries** feitas a partir dela. | `CONFIRMAR(humano)` |
| C3 | Apagar um exercício apaga os itens de ficha e as séries que o referenciam, **de todos os usuários**. | `CONFIRMAR(humano)` |

Hoje nenhuma rota apaga usuários, fichas ou exercícios.

### Progressão e métricas
- O código não faz nenhum cálculo: não há volume, 1RM, progressão de carga nem estatística. `TODO(humano)`: se isso existir no produto, definir as fórmulas aqui.
- Fuso horário: datas em `TIMESTAMP(3)` sem fuso. `TODO(humano)`.

## Invariantes (devem sempre ser verdade)
- Um usuário nunca lê nem altera a ficha de outro usuário (F1). `CONFIRMAR(humano)`
- A senha nunca é devolvida em resposta da API (U4). Hoje só o cadastro devolve o usuário. `CONFIRMAR(humano)`
- `TODO(humano)`: outras invariantes desejadas.

## Casos de borda conhecidos (comportamento atual, não verificado em execução)
- `PUT /routine/:id` com `"name": null` passa na validação e falha no banco (provável 500).
- `exerciseId` inexistente em `POST` ou `PUT /routine` gera erro de FK não tratado (provável 500).
- Dois cadastros simultâneos com o mesmo e-mail: um deles provavelmente recebe 500 em vez de 409.
- `Joao@x.com` e `joao@x.com` são contas diferentes.
