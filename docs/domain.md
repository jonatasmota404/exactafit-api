# Domínio — exactafit-api

> Fonte da verdade para regras de negócio. Agentes **não devem presumir** regras que não estão aqui; na dúvida, perguntar.
> As regras foram extraídas do código da versão da `main` de 2026-10-12 e revisadas pelo humano em 2026-10-12.
> **Revisão de escopo em 2026-11-09** ([ADR 0011](adr/0011-app-generico-plano-e-dado.md)): o produto é o descrito em [`produto.md`](produto.md) (visão, fases e critérios de aceite). Este arquivo guarda as regras; o `produto.md`, o que construir e em que ordem. Pontos que a consolidação deixou como pergunta e o humano mandou seguir com a recomendação do próprio documento estão marcados `DECIDIDO (por delegação)`.
>
> **Status das regras:**
> - `CONFIRMADO`: o humano validou o comportamento atual do código.
> - `DECIDIDO (muda o código)`: o humano decidiu algo diferente do que o código faz hoje. Ver "Mudanças de código decorrentes".
> - `ADIADO`: a decisão foi explicitamente adiada.
> - `DECIDIDO (por delegação)`: o humano autorizou aplicar as recomendações da IA sem perguntar caso a caso (a partir do bloco 9). Itens hoje com essa marca: a regra de F4 "pelo menos um dos dois obrigatório" (**não revisada pelo humano**) e, desde 2026-11-09, as recomendações da consolidação em `produto.md` que o humano mandou seguir sem perguntar.
> - `ADIADO (decidir no plano)`: detalhe de implementação que fica para o plano de cada tarefa.
> - `CONFIRMAR(humano)`: regra ainda não validada.

## Visão do produto
Ver [`produto.md`](produto.md), o [ADR 0011](adr/0011-app-generico-plano-e-dado.md) e as decisões abaixo.

**O que é:** app genérico de treino e dieta, de uso individual ou em família. Representa qualquer dieta e qualquer programa de treino definidos pelo usuário, de uma pessoa comum a um fisiculturista. Os dois planos reais (perfil A: déficit simples, 125 kg para 80 kg; perfil B: recomposição, 1,68 m e 67 kg) são **apenas modelos de exemplo**, carregados como dados que o usuário usa, copia e edita.

**Princípios** (`DECIDIDO`, revisão em 2026-11-09):
- **O plano é dado, não código.** Nada de perfis A/B, quantidade de refeições, prato de 4 peças ou regra de ajuste fixo no código.
- **Teste de generalidade:** a mesma engine representa o perfil A, o perfil B e um terceiro plano sem relação (push/pull/legs em 6 dias com superséries, 5 refeições e superávit), sem mudar código.
- **Household opcional:** toda feature funciona sem ele.
- **Assistente de criação opcional:** sugere metas e estrutura a partir do perfil, com fórmulas determinísticas; o plano resultante é sempre dado editável. Sem IA em tempo de execução (`DECIDIDO (por delegação)`).
- **Só academia:** sem perfis de equipamento nem programa de casa; o usuário escolhe qualquer exercício.
- **Sempre privado:** peso, medidas, fotos, ciclo, metas e sugestões. **Compartilhado no household** só o que é comida da casa: cardápio, prato cozinhado, visão da cozinha e lista de compras.
- **Menores de 18 anos** não recebem sugestões automáticas.
- **Não é dispositivo médico:** o app sugere; o usuário aceita ou recusa. Textos de aviso fixos.

**Fora do escopo agora:** ficha de treino gerada por IA em tempo de execução; os 1.324 exercícios do dataset e a mídia; importação inteira da TACO (a base de alimentos começa curada e editável); papéis de professor e academia; venda para terceiros; treino de casa e perfis de equipamento; ajuste automático por ciclo; linguagem de regras livre.

**Revisão em 2026-11-09.** Antes: app de treino para "eu e amigos", com visão futura de venda para academias (professor, matrícula em academia parceira), ficha padrão por IA, cardio e exercícios em casa no V1 e alimentação fora do V1.

## Decisões de produto (antes pendentes)

### (a) Uso offline e sincronização — DECIDIDO (muda o código)
- **Offline no V1: sim.** Alcance: só registrar o treino (abrir sessão e lançar séries) num treino que já estava no aparelho. Treinos e catálogo são só leitura offline. **Revisão em 2026-11-09:** o cálculo da porção também funciona sem rede ([ADR 0012](adr/0012-front-pwa.md)); se o registro de refeição entra no sincronismo, decide-se no plano da tarefa.
- **Sentido do sincronismo:** do aparelho para a API (sessões e séries). Os ids são gerados no cliente e o envio precisa poder repetir sem duplicar.
- **Conflito com S3:** se o sincronismo trouxer mais de uma sessão aberta do mesmo usuário, a API aceita todas e deixa aberta a de `startedAt` mais recente, encerrando as demais (critério revisado em 2026-10-12; o inicial era a ordem de chegada, que encerrava a sessão de hoje quando uma esquecida chegava tarde). Exceção de S3 só para o sincronismo.
- **Datas:** o aparelho envia `startedAt` e `finishedAt` (S1 muda; hoje é `now()` do servidor).
- **Resolvido depois:** `finishedAt` das encerradas = `startedAt` (S3); a data do cliente não é validada (S1); datas em UTC; duplicata de série evitada pelo id do cliente e pela constraint de S8.
- Formato do endpoint de sincronismo: `ADIADO (decidir no plano)`.
- ADR: [0004](adr/0004-uso-offline-e-sincronizacao.md).

### (b) Catálogo de exercícios — DECIDIDO (muda o código)
- **Catálogo inicial curado** e global, mais **exercício próprio e privado** do usuário (`DECIDIDO (por delegação)`; reabre o [ADR 0009](adr/0009-catalogo-de-exercicios-fechado.md)). Ver E1 e E2.
- O dataset completo (1.324 exercícios) e a mídia ficam **fora do escopo**. A fonte e o tamanho da carga inicial: ver P1.
- **Revisão em 2026-11-09** ([ADR 0011](adr/0011-app-generico-plano-e-dado.md)). Antes: catálogo fechado vindo só do dataset local, com carga repetível de 1.324 exercícios, mídia © Gym visual em volume na VPS e instruções em pt e en ([ADR 0005](adr/0005-carga-do-dataset-de-exercicios.md), substituído).

### (c) Alimentação — DECIDIDO (muda o código)
- **Dentro do escopo** (revisão em 2026-11-09; antes: fora do V1).
- **Plano de dieta** (`DietPlan`): refeições configuráveis (quantas e com que nome o usuário quiser, `MealSlot`) e metas de kcal, proteína, carboidrato e gordura por tipo de dia e por refeição (`DayTarget`). Fibra é opcional (`DECIDIDO (por delegação)`).
- **Alimento** (`Food`): macros por 100 g, estado cru ou pronto, tags de restrição; editável e importável por CSV. Rendimento cru → pronto em `FoodYield`.
- **Refeição modelo** (`MealTemplate`): composição livre ou por componentes, com meta por componente.
- **Porção:** a de qualquer item sai da meta escolhida (kcal, proteína ou carboidrato) dividida pelo valor do alimento por 100 g. Exemplo: arroz a 130 kcal/100 g dá cerca de 146 g para alvo de 190 kcal e cerca de 115 g para 150 kcal. Funciona sem rede.
- **Registro** (`MealLog`, `MealLogItem`): guarda **snapshot** dos macros no momento do registro; editar o alimento depois não muda o histórico.
- **Lista de compras:** da semana, com rendimento cru → pronto; ovos calculados do cardápio em **cartelas de 30**.
- **Evento social:** só dica opcional e botão "saí do plano", **sem contador negativo**.

### (d) Treino genérico — DECIDIDO (muda o código)
- **Treino** (`Workout`): a antiga ficha (ex.: "Treino A"). O **programa** (`Program`) só organiza os treinos no ciclo: ciclo semanal por dia da semana ou rotativo de N dias, com alternância por semana opcional (ex.: A-B). Dias (`ProgramDay`) apontam para treinos. **Implementado em 2026-11-11** (tarefa 6, schema; as rotas `/programs` são da tarefa 7).
- **Campos de `Program`:** `id`, `userId` (FK `RESTRICT`), `name` (até 100), `cycleType` (`WEEKLY` ou `ROTATING`), `cycleDays` (7 no semanal, N no rotativo), `weeks`, `startDate` (data que ancora o ciclo), `active`, timestamps. A contagem de qual semana e qual dia valem hoje (a partir de `startDate` e do fuso do usuário) fica para `GET /today` (tarefa 15).
- **Campos de `ProgramDay`:** `id`, `programId` (FK `CASCADE`), `week` (1 a `weeks`), `day` (dia da semana 1 a 7 no semanal; posição 1 a N no rotativo), `workoutId` (FK `RESTRICT`), `order` (permite mais de um treino no mesmo dia). Os limites desses números são da tarefa 7.
- **`weeks`** (alternância por semana) só existe no semanal; no rotativo é sempre 1.
- **Dia sem linha no programa é dia sem treino.** Nesse dia a tela Hoje mostra a caminhada, que é hábito do registro diário (`DayLog`, decisão (e)) e não um tipo de dia do programa. Uma caminhada planejada como treino é um `Workout` com exercício de cardio.
- **Um programa ativo por usuário**, vários programas permitidos. Garantido no service da tarefa 7 (o Prisma não declara índice parcial; um índice só no SQL viraria drift). O dono do treino de cada `ProgramDay` também é validado no service da tarefa 7.
- **Item do treino** (`WorkoutItem`, antes `RoutineItem`; os campos abaixo entram na tarefa 7, com migration): série normal, aquecimento, até a falha ou drop; faixa de repetições, tempo ou por lado; descanso; grupo de superssérie; RIR ou RPE opcional.
- **Progressão** (`ProgressionRule`) por exercício: dupla, linear ou nenhuma, com passo percentual. Dupla: +2 a 5% quando o máximo da faixa foi feito em todas as séries. Ao abrir o exercício, o app mostra a carga anterior e a sugestão.
- **Fases** (`Phase`): blocos definidos pelo usuário e semana leve a cada N semanas (Fase 4 do `produto.md`).
- `WorkoutRoutine` e `RoutineItem` foram **renomeados** para `Workout` e `WorkoutItem` (tarefa 6, [ADR 0014](adr/0014-ficha-vira-treino.md)); não são absorvidos por `Program`. As fichas existentes viram treinos fora de programa, e sessões e histórico apontam para os mesmos registros. **Revisão em 2026-11-11.** Antes: absorvidos por `Program`. As regras F valem para `Workout` e `WorkoutItem`.

### (e) Acompanhamento, revisão e sugestões — DECIDIDO (muda o código)
- `BodyMetric` (peso, medidas), `ProgressPhoto`, `CycleLog`, `DayLog` (passos, água, sono, caminhada). Meta de passos configurável por pessoa (modelos: A 8.000 a 10.000, B 7.000 a 9.000).
- **Peso oculto por escolha do usuário**, aplicado na API: a API não devolve o peso por padrão a quem escolheu ocultá-lo (esconder só na tela não basta).
- **Regras de revisão** (`ReviewRule`): só **tipos parametrizados** (variação de ritmo, estagnação, piso e teto), com janela, limite e ação sobre a meta; sem linguagem de regras livre (`DECIDIDO (por delegação)`). Presets dos perfis A e B. Uma regra = um teste.
- **Sugestão** (`Suggestion`): sempre aceita ou recusada pelo usuário; nunca aplicada sozinha. Média de 4 semanas no acompanhamento.
- **Pisos** (`DECIDIDO (por delegação)`): sugestão automática **nunca cruza o piso**. Plano definido pelo usuário fora do piso: avisa, mas permite. Piso para perfis genéricos: 1.700 kcal para mulheres e o gasto basal estimado para homens; o modelo do perfil B nunca abaixo de 1.700 kcal.
- **Assistente de criação:** fórmulas determinísticas de gasto e metas a partir do perfil (sexo, nascimento, altura); recusa menores de 18 anos.
- Placar semanal de hábitos **sem sequência que zera**.

### (f) Household e privacidade — DECIDIDO (muda o código)
- `Household` e `HouseholdMember`, opcionais; entrada por convite com código; sair não apaga os dados do usuário.
- Compartilhado entre membros: cardápio, prato cozinhado, visão da cozinha (as porções de cada um) e lista de compras. Todo o resto é do usuário (ver invariantes 12 e 13).
- Dados de saúde nunca vão para log.

### (g) Front — DECIDIDO
- PWA instalável e offline-first, em repositório próprio ([ADR 0012](adr/0012-front-pwa.md); `DECIDIDO (por delegação)`). Lembretes por push; no iOS só com o app instalado na tela inicial.

## Glossário
| Termo | Definição | Nome no código |
|---|---|---|
| Usuário | Pessoa com conta (e-mail e senha) que monta treinos e registra treinos. Todos têm as mesmas permissões no V1. É desativado por padrão e só é apagado a pedido do titular, por fluxo explícito de exclusão de conta. | `User` |
| Exercício | Item do catálogo inicial (global) ou exercício próprio do usuário, visível só a ele. Tem nome e grupo muscular. (**Revisão em 2026-11-09**, [ADR 0011](adr/0011-app-generico-plano-e-dado.md). Antes: catálogo fechado, sem exercício do usuário, ADR 0009.) | `Exercise` |
| Catálogo | Conjunto global e somente leitura de exercícios, carregado pela carga inicial curada (P1). Exercício do catálogo não tem dono. (**Revisão em 2026-11-09**, [ADR 0011](adr/0011-app-generico-plano-e-dado.md). Antes: único catálogo, vindo do dataset de 1.324 exercícios.) | `Exercise` (sem dono) |
| Treino | Plano do usuário (ex.: "Treino A"): nome, descrição opcional e itens ordenados (até 50). Até 10 treinos **ativos** por usuário; é arquivado e não é apagado (só no fluxo de exclusão de conta). Sem itens, é rascunho. Antes da tarefa 6 chamava-se "ficha de treino" (`WorkoutRoutine`; [ADR 0014](adr/0014-ficha-vira-treino.md)). | `Workout` |
| Item do treino | Um exercício dentro do treino, com ordem, número de séries-alvo e repetições-alvo. | `WorkoutItem` (antes `RoutineItem`) |
| Sessão de treino | Um treino realizado a partir de um treino (`Workout`). Fica aberta enquanto `finishedAt` estiver vazio. Início e fim vêm do aparelho. | `WorkoutSession` |
| Série registrada | Um registro dentro da sessão: exercício, número da série e (opcionais) repetições, carga e duração. Pode ser corrigida, nunca apagada. | `SetLog` |
| Série falhada | Série em que não completei as repetições planejadas. Informada pelo usuário. | `SetLog.failed` |
| Carga | Peso em kg, `Decimal(6,2)`. Vazia significa sem carga. | `SetLog.weightKg` |
| Grupo muscular | Um dos 10 valores de `body_part` do dataset: back, cardio, chest, lower arms, lower legs, neck, shoulders, upper arms, upper legs, waist. `cardio` define o exercício de cardio. | `Exercise.muscleGroup` |
| Sincronismo | Envio, do aparelho para a API, das sessões e séries registradas offline, com ids gerados no cliente. | não existe |
| Programa | Organiza os treinos do usuário num ciclo semanal ou rotativo de N dias; um programa **ativo** por usuário (ativar um desativa o anterior; regra da tarefa 7). Não substitui o treino. | `Program`, `ProgramDay` (schema implementado em 2026-11-11, tarefa 6; ainda sem rota) |
| Plano de dieta | Refeições configuráveis e metas de macros por tipo de dia e por refeição. | `DietPlan` (a criar) |
| Modelo | Plano de exemplo (dieta, treino, regras) carregado como dado, que o usuário usa ou copia. Os perfis A e B são modelos. | `PlanTemplate` (a criar) |
| Household | Grupo opcional (família) que compartilha só a comida da casa. | `Household` (a criar) |
| Sugestão | Proposta de mudança de meta gerada por uma regra de revisão; o usuário aceita ou recusa. | `Suggestion` (a criar) |

## Regras de negócio

### Usuários e acesso
| # | Regra | Onde | Status |
|---|---|---|---|
| U1 | O e-mail é único e **normalizado** (trim + minúsculas) antes de gravar e de comparar. Hoje o código não normaliza. Cadastro com e-mail existente → 409. | `auth.service.ts`, DTOs | `DECIDIDO (muda o código)` |
| U2 | Nome obrigatório, até 100 caracteres. E-mail válido, até 255. | `register.dto.ts` | `CONFIRMADO` |
| U3 | **Cadastro:** senha com **mínimo de 8** caracteres (hoje o código exige 6) e máximo de 72 **caracteres** (limite do bcrypt, confirmado; o bcrypt conta bytes e ignora o excedente em silêncio, risco aceito). **Login:** a senha só precisa ser **não vazia**, com máximo de 72; o mínimo de 8 **não** vale no login (hoje o login exige mínimo 6). Contas com senha de 6–7 caracteres continuam entrando. **Revisão em 2026-10-12.** Antes: o login também exigia mínimo de 8, e contas de 6–7 caracteres ficavam sem acesso e, sem troca de senha, sem como voltar. Depois: mínimo de 8 só no cadastro. Ver [ADR 0008](adr/0008-minimo-de-senha-so-no-cadastro.md). | `register.dto.ts`, `login.dto.ts` | `DECIDIDO (muda o código)` |
| U4 | A senha é guardada como hash bcrypt (custo 10) e nunca volta em resposta da API. Como evitar devolver o `password` (hoje removido à mão no cadastro) é decisão de implementação, no plano. | `auth.service.ts` `create` | `CONFIRMADO` |
| U5 | Login com e-mail inexistente e login com senha errada dão **respostas diferentes**, ambas 401 (hoje as duas são 401 `"Credenciais inválidas"`). Texto exato: `ADIADO (decidir no plano)`; sugestão da IA, não confirmada: "E-mail não cadastrado" e "Senha incorreta". `TODO(humano)`: reavaliar a resposta genérica (que não revela se o e-mail existe) se o app for aberto a terceiros; exigiria mudar também o 409 do cadastro (U1). O cadastro já revela se o e-mail existe (409), então a separação não abre um vazamento novo. | `auth.service.ts` `login` | `DECIDIDO (muda o código)` |
| U6 | O token é um JWT com `sub` = id do usuário e `email`, válido por 7 dias, sem refresh nem revogação. A decisão sobre expiração e refresh fica para a fase do front. Reconfirmado adiado mesmo com o offline do V1: aparelho com mais de 7 dias sem sincronizar recebe 401 e precisa de novo login antes de enviar (risco aceito). | `auth.module.ts`, `auth.service.ts` | `ADIADO` |
| U7 | Não existem papéis: todo usuário autenticado tem as mesmas permissões no V1 (professor e academia ficam fora do V1). | ausência no código | `CONFIRMADO` |
| U8 | A aplicação não sobe sem `JWT_SECRET` nem com valor de **menos de 32 caracteres** (decidido em 2026-10-18; base: RFC 7518 §3.2 para HS256). A mensagem de erro não mostra o valor. Implementado em 2026-10-18 (`fix/jwt-secret-obrigatorio`, plano `docs/plans/2026-10-18-jwt-secret-e-shutdown.md`); antes usava um segredo fixo de reserva. Deploy no V1: VPS própria. `JWT_SECRET` é variável de ambiente do serviço no Coolify, **somente em runtime** (não em build), com cópia do valor em gerenciador de senhas; nunca no repositório. A API **ainda não está em produção**: não há tokens emitidos nem segredo a migrar ao remover o fallback. | `auth.module.ts` | `CONFIRMADO` |

### Exercícios
| # | Regra | Onde | Status |
|---|---|---|---|
| E1 | Há um **catálogo** global (carga inicial curada, P1) e **exercícios próprios** do usuário. Exercício próprio é **privado**: só o dono vê e usa. **Implementado em 2026-11-11** (tarefa 4): `Exercise.userId` opcional (nulo = catálogo); os exercícios que já existiam viraram catálogo. **Revisão em 2026-11-09** ([ADR 0011](adr/0011-app-generico-plano-e-dado.md), `DECIDIDO (por delegação)`). Antes: catálogo fechado, sem exercício do usuário ([ADR 0009](adr/0009-catalogo-de-exercicios-fechado.md), substituído). | `schema.prisma`, `exercises.service.ts` | `DECIDIDO (muda o código)` |
| E2 | `POST /exercises` cria exercício **próprio** do usuário do token, nunca do catálogo. `GET /exercises` devolve o catálogo mais os próprios. **Implementado em 2026-11-11** (tarefa 4): o `POST` grava o `userId` do token (nunca do body) e o `GET` filtra por catálogo ou dono. Exercício de outro usuário se comporta como inexistente: 400 no item de treino (F6) e 404 na série (S8); não há `GET /exercises/:id`. Editar e apagar o próprio ficam para tarefa separada (decisão do humano em 2026-11-11; E6 vale). **Revisão em 2026-11-09** ([ADR 0011](adr/0011-app-generico-plano-e-dado.md)). Antes: usuário não criava exercício e o destino do `POST` estava em aberto (P1 antigo). | `exercises.controller.ts`, `exercises.service.ts` | `DECIDIDO (muda o código)` |
| E3 | `name` obrigatório, até 100 caracteres. No dataset o maior nome tem 67. | `create-exercises.dto.ts` | `CONFIRMADO` |
| E4 | `muscleGroup` aceita só os 10 valores de `body_part` do dataset: back, cardio, chest, lower arms, lower legs, neck, shoulders, upper arms, upper legs, waist (hoje é texto livre). O campo `type` **sai**: o cardio é decidido por `muscleGroup = cardio` (o dataset não tem `type`; antes ele tinha padrão `strength`). Quem ainda enviar `type` no `POST /exercises` recebe 400. `TODO(humano)`: tradução dos valores para o app. | `create-exercises.dto.ts`, `schema.prisma` | `DECIDIDO (muda o código)` |
| E5 | Nomes duplicados são permitidos (no dataset, 6 nomes se repetem). | ausência de `@unique` | `CONFIRMADO` |
| E6 | Um exercício com séries registradas não pode ser apagado; um que está em treino ou programa também não (C3). Ver [ADR 0001](adr/0001-exclusao-sem-cascata-de-historico.md). Vale para o catálogo e para o exercício próprio. **Revisão em 2026-11-09.** Antes: não havia remoção por usuário porque não havia exercício próprio. | `schema.prisma` (hoje cascade) | `DECIDIDO (muda o código)` |

### Treinos
Valem para `Workout` e `WorkoutItem` (antes `WorkoutRoutine` e `RoutineItem`; renomeados na tarefa 6, decisão (d) e [ADR 0014](adr/0014-ficha-vira-treino.md)), com os mesmos números.

| # | Regra | Onde | Status |
|---|---|---|---|
| F1 | Um treino pertence ao usuário do token. Um usuário só lista, lê e altera os próprios treinos. O treino de outro usuário responde 404. **Trade-offs aceitos:** (1) 404 em vez de 403 esconde que o treino existe, mas o app não distingue "não existe" de "não é sua". (2) Sem compartilhamento no V1: amigo não vê nem copia o treino, e o professor montar o treino do aluno (visão futura) exigirá exceção a F1. (3) Hoje o `PUT` checa a posse fora da transação e escreve filtrando só por `id`, o que foge da convenção "toda query filtra por `userId`" (risco de corrida baixo, não verificado em execução). (4) Com o offline, o aparelho pode enviar sessão de treino já arquivado; ela é aceita (S1). | `workouts.service.ts` | `CONFIRMADO` |
| F2 | Nome obrigatório, até 100 caracteres. Descrição opcional, até 255. | `create-workout.dto.ts` | `CONFIRMADO` |
| F2a | `name` só com espaços (`"   "`) é aceito hoje no `POST` e no `PUT`. **ADIADO: tratar junto com a tarefa de F4/F11 (trim do nome no POST e no PUT).** | `create-workout.dto.ts`, `update-workout.dto.ts` | `ADIADO` |
| F2b | `description: null` no `PUT` limpa a descrição (confirmado pelo humano). A validação aceita o `null`; a gravação não foi verificada em execução. Um teste que trave a regra entra na tarefa de F4/F11. | `update-workout.dto.ts`, `workouts.service.ts` | `CONFIRMADO` |
| F3 | Treino sem itens é permitido, como rascunho. "Rascunho" **não** é um estado explícito: é só um treino sem itens (decidido: opção A). | `create-workout.dto.ts` | `CONFIRMADO` |
| F4 | `targetSets` de 1 a 20, `targetReps` de 1 a 100 **quando informado**, `order` ≥ 0 (hoje qualquer inteiro passa). Para cardio, o item ganha a duração-alvo em segundos (campo novo, opcional) e `targetReps` passa a ser opcional (decidido: opção A). Pelo menos um dos dois é obrigatório (`DECIDIDO (por delegação)`). `TODO(humano)`: faixa da duração-alvo. | `create-workout.dto.ts` | `DECIDIDO (muda o código)` |
| F5 | O mesmo exercício pode aparecer mais de uma vez no treino, desde que o `order` seja único. | ausência de constraint | `CONFIRMADO` |
| F6 | O item do treino só aceita exercício do catálogo ou próprio do usuário (E1). Exercício inexistente ou de outro usuário dá a mesma resposta 400 "Exercício não encontrado". **Implementado em 2026-11-11** (tarefa 4): a mensagem **não indica o item** (decidido no plano). **Revisão em 2026-11-09** (ADR 0011). Antes: só catálogo (ADR 0009). | `schema.prisma`, `workouts.service.ts` | `DECIDIDO (muda o código)` |
| F7 | Os itens são devolvidos em ordem crescente de `order`, com os dados do exercício. | `workouts.service.ts` | `CONFIRMADO` |
| F8 | A atualização é parcial. Se `items` vier, substitui todos os itens, que ganham ids novos. Isso é aceitável porque o histórico (`SetLog`) guarda o `exerciseId` e não depende dos itens do treino. | `workouts.service.ts` `update` | `CONFIRMADO` |
| F9 | O treino é **arquivado**, nunca apagada. Hoje não há exclusão nem arquivamento. O treino arquivado pode **voltar a ser ativo** (arquivar e desarquivar). `GET /workouts` devolve só os ativos por padrão; os arquivados só vêm se pedidos e continuam acessíveis pelo id. O treino arquivado **pode ser editado**. Ver [ADR 0001](adr/0001-exclusao-sem-cascata-de-historico.md). Formato da ação de arquivar/desarquivar: `ADIADO (decidir no plano)`. | `schema.prisma`, `workouts.*` | `DECIDIDO (muda o código)` |
| F10 | Limites: **no máximo 10 treinos ativos por usuário** e **no máximo 50 itens por treino**. O treino arquivado **não conta** no limite: arquivar libera espaço e o histórico continua guardado (**revisão** da decisão anterior, em que a arquivada contava; confirmada pelo humano). Consequência: treinos arquivados não têm teto; `TODO(humano)`: se precisa de um. Resposta de erro ao passar do limite: `ADIADO (decidir no plano)`. **F10 só será implementada junto com F9** (campo de arquivamento): nenhuma tarefa implementa F10 antes (decisão do humano). | ausência no código | `DECIDIDO (muda o código)` |
| F11 | O `order` é único dentro do treino (hoje pode repetir). Só precisa ser único: lacunas são permitidas (decidido: opção A). | `create-workout.dto.ts`, `schema.prisma` | `DECIDIDO (muda o código)` |

### Sessões e séries (rotas: `POST /sessions`, `PATCH /sessions/:id`, `POST /sessions/:id/sets`, `PATCH /sessions/:id/sets/:setId`; testes em `test/sessions.e2e-spec.ts` e `test/sessions-caracterizacao.e2e-spec.ts`)
| # | Regra | Onde | Status |
|---|---|---|---|
| S1 | Uma sessão pertence a um usuário e a um treino. O início (`startedAt`) e o fim (`finishedAt`) vêm do aparelho, por causa do offline. Sessão de treino já arquivado é aceita. A API exige o **formato** (data, hora e fuso; sem fuso ou data impossível, 400), mas **não valida a faixa** da data (decidido: opção B; risco aceito: treino no futuro ou duração negativa). Datas gravadas em UTC; o app exibe no fuso do aparelho. **Implementado em 2026-11-10 para o início** (tarefa 2, [ADR 0013](adr/0013-idempotencia-por-id-do-cliente.md)): `startedAt` é obrigatório no `POST /sessions`; antes era `now()` do servidor. **Implementado em 2026-11-11 para o fim** (tarefa 3): `PATCH /sessions/:id` recebe `finishedAt` (e corrige `startedAt`) no mesmo formato, sem validar faixa. Limite do formato (não é faixa de negócio): data que, convertida para UTC, passa do ano 9999 dá 400 no `POST` e no `PATCH`, porque o banco não a devolve (tarefa 3, achado da revisão). | `schema.prisma` `WorkoutSession` | `DECIDIDO (muda o código)` |
| S2 | A sessão tem `finishedAt` opcional: vazio significa sessão aberta. **Coluna criada em 2026-11-10** (tarefa 2); a sessão nasce com `finishedAt` nulo. **Rota de encerramento em 2026-11-11** (tarefa 3): `PATCH /sessions/:id`. | `schema.prisma` | `DECIDIDO (muda o código)` |
| S3 | Cada usuário tem no máximo uma sessão aberta. **Exceção do sincronismo:** se chegarem várias abertas, a API aceita todas e fica aberta a de `startedAt` **mais recente**; as demais são encerradas com `finishedAt = startedAt` (duração zero, "encerrada automaticamente"). Isso revisa o critério "última a chegar" inicial (caso de borda 5; custo aceito: depende do relógio do aparelho, que S1 não valida). **Online** (`POST /sessions`): com uma sessão já aberta, um início com outro `id` dá **409** e nada é gravado; o app oferece encerrar a aberta antes (decisão do humano em 2026-11-11, pergunta P2 da auditoria; alternativa descartada: encerrar a anterior automaticamente, que fecharia sem perguntar um treino esquecido aberto). Reenvio do `id` da sessão aberta continua 200 (ADR 0013). **Implementado em 2026-11-11 para o online** (tarefa 3), checado no service; o índice único parcial que garante a regra com dois aparelhos ao mesmo tempo e a exceção do sincronismo ficam para a tarefa 17. | `sessions.service.ts` | `DECIDIDO (muda o código)` |
| S4 | Treino sem itens não pode iniciar sessão **ao iniciar online**. O sincronismo aceita a sessão mesmo que o treino tenha ficado vazio depois (decidido: opção A; o treino já aconteceu). **Implementado em 2026-11-11** (tarefa 3): `POST /sessions` é a rota online (o sincronismo terá endpoint próprio, tarefa 17) e responde **400** para treino sem itens; o reenvio de um `id` já gravado continua 200, mesmo que o treino tenha ficado vazio depois. | `sessions.service.ts` | `DECIDIDO (muda o código)` |
| S5 | Uma série registrada tem `setNumber`, `failed` (padrão `false`) e referencia um exercício. `repsCompleted`, `weightKg` e a duração (segundos, só para cardio; campo novo) são **opcionais**. A API não valida o que cada série precisa ter: uma série vazia é aceita e os relatórios devem tolerar (decidido: opção B). Cardio registra só tempo; distância fica fora do V1. Os ids das séries e das sessões são gerados no cliente (offline). **Implementado em 2026-11-10 para a sessão e para as colunas da série** (tarefa 2, [ADR 0013](adr/0013-idempotencia-por-id-do-cliente.md)): `id` de sessão é obrigatório no `POST /sessions` e vale sem diferenciar maiúsculas (gravado em minúsculas); reenviar o mesmo `id` pelo mesmo usuário devolve 200 com a sessão original, sem alterar nada; `id` de sessão de outro usuário dá 409. `weightKg`, `repsCompleted` e `durationSeconds` são opcionais no banco. **Rota de série em 2026-11-11** (tarefa 3): `POST /sessions/:id/sets` exige `id` (UUID do aparelho, gravado em minúsculas), `exerciseId` e `setNumber` ≥ 1; `repsCompleted` e `durationSeconds` ≥ 0; reenvio do mesmo `id` pelo mesmo usuário dá 200 com a original; `id` de série de outro usuário dá 409. | `schema.prisma` `SetLog` | `DECIDIDO (muda o código)` |
| S6 | `failed` = série em que não completei as repetições planejadas. O valor é **informado pelo usuário**; a API não confere com `repsCompleted` (risco aceito: pode contradizer). Ver [ADR 0002](adr/0002-definicao-de-serie-falhada.md). | `SetLog.failed` | `DECIDIDO` |
| S7 | A carga é em kg, `Decimal(6,2)` (0,00 a 9999,99). Vazia significa sem carga (peso do corpo). **Implementado em 2026-11-10** (tarefa 2): o banco recusa 10000 ou mais. | `SetLog.weightKg` | `DECIDIDO (muda o código)` |
| S8 | O número da série é único por sessão e exercício (constraint no banco; duplicata dá 409). O app continua a numeração quando o mesmo exercício reaparece no treino (F5). No sincronismo, uma série em conflito não derruba o lote. Série de exercício que **não está no treino** da sessão é aceita, desde que o exercício exista e seja visível ao usuário (catálogo ou próprio) (**revisão em 2026-11-09**, ADR 0011; antes: "exista no catálogo", ADR 0009); relatórios devem tolerar série sem item correspondente (decidido: opção A). **Constraint criada em 2026-11-10** (tarefa 2); **409 na rota de série em 2026-11-11** (tarefa 3), no registro e na correção do `setNumber`. Exercício inexistente ou de outro usuário dá 404 "Exercício não encontrado" (**implementado em 2026-11-11**, tarefa 4). | `schema.prisma` | `DECIDIDO (muda o código)` |
| S9 | O usuário **corrige** série e sessão registradas (atualização por id), mas **nunca apaga** (decidido: opção A). Uma sessão registrada **nunca é apagada**; erro se corrige editando a sessão. Motivo: com sincronização offline, apagar uma sessão exigiria um marcador de exclusão, e um aparelho antigo poderia ressuscitá-la. Uma sessão aberta por engano se encerra. Uma sessão encerrada **não reabre**: `finishedAt`, depois de preenchido, não volta a vazio (decidido: opção A; encerrar por engano obriga a abrir sessão nova). Uma sessão encerrada **aceita série nova** (série esquecida; decisão do humano em 2026-11-11). **Implementado em 2026-11-11** (tarefa 3): `PATCH /sessions/:id` (só `startedAt` e `finishedAt`; `finishedAt: null` dá 400) e `PATCH /sessions/:id/sets/:setId` (`weightKg`, `repsCompleted`, `durationSeconds`, `failed`, `setNumber`; `null` limpa os opcionais). O treino da sessão e o exercício da série não se corrigem (400). Sessão ou série de outro usuário dá 404. Sem rota `DELETE`. | `sessions.controller.ts`, `sessions.service.ts` | `DECIDIDO (muda o código)` |

### Exclusão (ver [ADR 0001](adr/0001-exclusao-sem-cascata-de-historico.md))
| # | Regra | Status |
|---|---|---|
| C1 | O usuário **nunca é apagado**, só desativado (decidido: opção B). `User` ganha um campo de desativação e as FKs de `User` viram restrição. O `AuthGuard` passa a verificar se o usuário **existe e está ativo** a cada pedido e recusa com 401 o inexistente e o desativado, mesmo com token válido (decidido: opção A; custo: uma consulta por requisição, toca `src/auth/`). Hoje o guard só verifica a assinatura e não consulta o banco (confirmado por teste de caracterização, `test/authguard-caracterizacao.e2e-spec.ts`): um usuário desativado continuaria acessando por até 7 dias, a validade do token (U6). O e-mail do desativado continua ocupado (cadastro com ele dá 409). **Exceção:** a pedido do titular, um fluxo explícito de **exclusão de conta apaga todos os dados do usuário** (decisão do humano; sem texto jurídico). Como as FKs são restrição (C3), o fluxo roda numa transação que remove antes séries, sessões, programas (e seus dias), itens e treinos, e depois o usuário. Apaga também os exercícios próprios do usuário e todos os dados de dieta, medidas, fotos, ciclo, hábitos e sugestões; exercícios do catálogo não são apagados. Se o usuário está num household, sai dele antes. **Revisão em 2026-11-09** (ADR 0011). Antes: não havia exercício do usuário (ADR 0009). `TODO(humano)`: o processo (canal de contato e prazo), antes de haver usuários de terceiros. | `DECIDIDO (muda o código)` |
| C2 | Histórico (sessões e séries) nunca é apagado em cascata. Treinos são arquivados (F9). **Implementado em 2026-11-10** (tarefa 2, [ADR 0013](adr/0013-idempotencia-por-id-do-cliente.md)): apagar sessão com série, treino ou usuário com sessão, ou exercício com série é recusado pelo banco. Antes: apagar uma ficha (hoje treino) apagava as sessões e séries dela. | `DECIDIDO (muda o código)` |
| C3 | Um exercício com séries registradas **ou em algum treino** não pode ser apagado (E6). FKs que viram restrição: `SetLog.exerciseId`, `WorkoutItem.exerciseId`, `WorkoutSession.workoutId`, `SetLog.sessionId`, `WorkoutSession.userId`, `Workout.userId`. `WorkoutItem.workoutId` continua cascade. **Revisão em 2026-10-14** ([ADR 0009](adr/0009-catalogo-de-exercicios-fechado.md)). Antes: citava E2 e o 409 na remoção do próprio exercício, e previa a FK nova `Exercise.userId` (dono) em cascata, disparada só na exclusão de conta. Depois: sem rota de remoção por usuário e sem `Exercise.userId`. **Revisão em 2026-11-09** (ADR 0011): `Exercise.userId` (dono) volta com o exercício próprio; o comportamento da FK fica para o plano da tarefa, respeitando E6 e C1. **Implementado em 2026-11-10** (tarefa 2): `SetLog.exerciseId`, `WorkoutSession.workoutId` (então `routineId`), `SetLog.sessionId` e `WorkoutSession.userId` são restrição. **Implementado em 2026-11-11** (tarefa 6): `Workout.userId` e `WorkoutItem.exerciseId` também são `RESTRICT`; FKs novas: `Program.userId` `RESTRICT`, `ProgramDay.workoutId` `RESTRICT` e `ProgramDay.programId` `CASCADE` (o dia é parte do programa). **Implementado em 2026-11-11** (tarefa 4): `Exercise.userId` (dono) é `RESTRICT`; a exclusão de conta apagará os exercícios próprios explicitamente. | `DECIDIDO (muda o código)` |

### Progressão e métricas
- **Dentro do escopo** (revisão em 2026-11-09; antes: fora do V1): carga anterior e sugestão da próxima pela regra de progressão do item (decisão (d)) e média de 4 semanas no acompanhamento (decisão (e)). O histórico continua preservado, então outras métricas podem ser calculadas depois sobre os mesmos dados.
- Fuso horário: datas em UTC (`TIMESTAMP(3)` sem fuso); o app exibe no fuso do aparelho (decidido: opção A). "Treinos por dia" precisa do fuso do aparelho em cada pedido ou fica por UTC.

## Invariantes (devem sempre ser verdade)
1. Um usuário nunca lê nem altera o treino de outro (F1). `CONFIRMADO`
2. A senha nunca é devolvida em resposta da API (U4). `CONFIRMADO`
3. Histórico de sessões e séries nunca é apagado em cascata (C2); só o fluxo de exclusão de conta a pedido do titular apaga histórico (C1). `DECIDIDO`
4. Cada usuário tem no máximo uma sessão aberta (S3), valendo depois de cada sincronismo, que encerra as excedentes. `DECIDIDO`
5. O `order` é único dentro de cada treino; lacunas são permitidas (F11). `DECIDIDO`
6. Usuários nunca alteram nem apagam exercícios do catálogo; exercício próprio só é visto e usado pelo dono (E1, E2). `DECIDIDO` (**revisão em 2026-11-09**; antes: "usuários nunca criam, alteram nem apagam exercícios")
7. Um item de treino e uma série só referenciam exercício do catálogo ou do próprio usuário (F6, S8). `DECIDIDO` (**revisão em 2026-11-09**; antes: "só do catálogo")
8. Série e sessão registradas nunca são apagadas, só corrigidas (S9), exceto pela exclusão de conta (C1). `DECIDIDO`
9. O usuário é desativado, não apagado, exceto pelo fluxo de exclusão de conta a pedido do titular (C1). `DECIDIDO`
10. Um usuário tem no máximo 10 treinos ativos, e um treino tem no máximo 50 itens (F10). `DECIDIDO`
11. O número da série é único por sessão e exercício (S8). `DECIDIDO`
12. Peso, medidas, fotos, ciclo, metas e sugestões de um usuário nunca são devolvidos a outro, nem dentro do mesmo household (decisões (e) e (f)). `DECIDIDO`
13. O household compartilha só cardápio, prato cozinhado, visão da cozinha e lista de compras; toda feature funciona sem household (f). `DECIDIDO`
14. Sugestão automática nunca é aplicada sem aceite do usuário, nunca cruza o piso e nunca é gerada para menor de 18 anos (e). `DECIDIDO`
15. Nenhum valor dos perfis A e B fica fixo no código: entram como modelos (dados) ([ADR 0011](adr/0011-app-generico-plano-e-dado.md)). `DECIDIDO`
16. O registro de refeição guarda snapshot dos macros; mudar o alimento depois não altera o histórico (c). `DECIDIDO`

## Casos de borda conhecidos (comportamento atual, não verificado em execução)
Cada caso virou correção, validação ou comportamento aceito. Os casos foram decididos com o humano; o 6 começou por delegação e foi depois **confirmado** por ele.

| # | Caso | Decisão |
|---|---|---|
| 1 | `PUT /workouts/:id` (então `/routine/:id`) com `"name": null` passava na validação e falhava no Prisma (500). | **Resolvido:** `null` e `''` em `name` no `PUT` dão 400. Filtrar por `userId` na escrita (F1, trade-off 3) é tarefa separada. |
| 2 | `exerciseId` inexistente em `POST` ou `PUT /workouts` (então `/routine`) gera erro de FK não tratado (provável 500). | **Resolvido por F6:** 400 para exercício inexistente (revisão em 2026-10-14; antes também "de outro usuário", que deixou de existir com o catálogo fechado). |
| 3 | Dois cadastros simultâneos com o mesmo e-mail: um deles provavelmente recebe 500 em vez de 409. | **Correção:** a violação de unicidade do banco responde 409. |
| 4 | `Joao@x.com` e `joao@x.com` são contas diferentes. | **Resolvido por U1:** e-mail normalizado. |
| 5 | Sessão antiga esquecida aberta, sincronizada tarde, encerrava a sessão de hoje. | **Resolvido em S3:** vence a de `startedAt` mais recente. |
| 6 | Login sem limite de tentativas; com as mensagens separadas de U5, permite descobrir e-mails e tentar senhas sem teto. | **Correção (confirmada pelo humano):** no máximo **5 tentativas por 15 minutos, por e-mail e IP**. Revisão: o humano pediu também resposta genérica, mas manteve U5 (mensagens separadas); reavaliar a resposta genérica se o app for aberto a terceiros (`TODO(humano)`, ver U5). Se a implementação exigir dependência nova, ela **precisa da aprovação do humano no plano**. |

## Decisões pendentes
Perguntas ao dono, **sem decisão**. Nenhuma tarefa presume a resposta.

| # | Pergunta | Origem | Status |
|---|---|---|---|
| P1 | De onde vem a carga inicial do catálogo e quantos exercícios entram (o dataset completo e a mídia estão fora)? Bloqueia só a tarefa de carga do catálogo. | (b), E1 | `TODO(humano)` |
| P2 | Fotos de progresso: guardar no servidor ou só lembrar de tirar? Bloqueia só a Fase 2. | (e) | `TODO(humano)` |
| P3 | Qual celular cada um usa (Android ou iPhone), por causa dos lembretes? Bloqueia só a Fase 3. | (g) | `TODO(humano)` |
| P4 | Supino inclinado do perfil B no modelo: "2 ×" significa 2 séries ou 2 vezes por semana? Bloqueia só a carga do modelo B. | `produto.md` §5 | `TODO(humano)` |

## Mudanças de código decorrentes
Nada disso está implementado, salvo onde a linha diz "Implementado". Cada item segue a tabela "Risco: quem decide o quê" do `AGENTS.md`. O risco é **baixo**, **médio** ou **alto**. As áreas novas (dieta, programa, acompanhamento, household, front) estão em [`produto.md`](produto.md), seção 9, na ordem de execução.

| Regras | O que muda | Risco |
|---|---|---|
| U1, caso 4 | Normalizar o e-mail (trim + minúsculas) no cadastro e no login. Antes de mudar, verificar se o banco já tem e-mails que colidem depois de normalizados. | **Médio**: toca `src/auth/`; dados existentes podem colidir. |
| U3 | `@MinLength(8)` só em `register.dto.ts`. Em `login.dto.ts`, trocar `@MinLength(6)` por `@IsNotEmpty()`, mantendo `@MaxLength(72)`. Ver [ADR 0008](adr/0008-minimo-de-senha-so-no-cadastro.md). | **Baixo**: só validação, mas toca `src/auth/`. O login fica mais permissivo e contas de 6–7 caracteres continuam entrando; só cadastros novos com menos de 8 recebem 400. |
| U5 | Respostas 401 distintas para e-mail inexistente e senha errada. Texto exato no plano. | **Baixo**: toca `src/auth/`, mudança de mensagem. |
| U8 | **Implementado em 2026-10-18** (`fix/jwt-secret-obrigatorio`), com mínimo de 32 caracteres. Remover o fallback fixo em `auth.module.ts` e falhar na inicialização sem `JWT_SECRET`. (`dotenv` já é dependência direta: `package.json:35`.) `JWT_SECRET` como variável de ambiente do serviço no Coolify, só em runtime, com cópia em gerenciador de senhas. Não há tokens nem segredo a migrar (a API não está em produção). | **Médio**: toca `src/auth/`; quebra ambientes sem a variável (desenvolvimento, CI, e2e). |
| Caso 3 | Tratar a violação de unicidade no cadastro e responder 409. | **Baixo**: toca `src/auth/`. |
| Caso 6 | Limite de 5 tentativas por 15 minutos, por e-mail e IP, no login. Mecanismo no plano; se exigir dependência nova, precisa da aprovação do humano. | **Médio**: toca `src/auth/`; pode bloquear usuário legítimo; possível dependência nova. |
| C1 | Campo de desativação em `User` + migration; FKs de `User` viram restrição. | **Médio**: schema e migration; muda o comportamento de exclusão (ver C3). |
| C1 (AuthGuard) | O `AuthGuard` passa a consultar o usuário a cada pedido e recusar com 401 o inexistente e o desativado. Hoje só verifica a assinatura. Depende do campo de desativação da linha anterior. **Plano próprio**; não implementado. | **Médio**: toca `src/auth/` (zona de risco); uma consulta a mais por requisição; o teste de caracterização que afirma o comportamento atual (aceita token de usuário inexistente) passa a falhar de propósito. |
| E1 (`Exercise.userId`) | **Revisão em 2026-11-09** (ADR 0011). Dono opcional em `Exercise` (nulo = catálogo) + migration; `GET /exercises` devolve catálogo + próprios; `POST` grava o `userId` do token. **Implementado em 2026-11-11** (tarefa 4). Os exercícios que já existiam no banco viraram catálogo, sem dono (decisão do humano; a API não está em produção, U8). | **Alto**: schema e migration; muda o contrato de `GET /exercises`. |
| E2 (`POST /exercises`) | **Revisão em 2026-11-09** (ADR 0011). `POST /exercises` cria exercício próprio; exercício de outro usuário dá 404. Depende da linha anterior. | **Médio**: muda quem vê o exercício criado; o teste de caracterização de "todos veem todos" passa a falhar de propósito. |
| E1, E2 (testes de caracterização) | `test/exercises-caracterizacao.e2e-spec.ts` trava "todos veem todos" e o `POST` sem dono. A tarefa de E1/E2 troca esses testes pelo comportamento novo, declarando `Teste alterado: <motivo>`. | **Baixo**: só testes. |
| E4 | `muscleGroup` limitado aos 10 valores de `body_part` (enum no schema ou `@IsIn`, a decidir no plano). **Remover** a coluna `type` e o campo do DTO. Cardio = `muscleGroup = cardio`. | **Alto**: a migration apaga uma coluna e quebra quem envia `type` (400); dados fora da lista quebram a migration. |
| E6, C2, C3 | **Implementado em 2026-11-10 para quatro FKs** (tarefa 2): `SetLog.exerciseId`, `WorkoutSession.workoutId` (então `routineId`), `SetLog.sessionId` e `WorkoutSession.userId`. **Implementado em 2026-11-11 para as duas restantes** (tarefa 6): `Workout.userId` e `WorkoutItem.exerciseId`. Seis FKs de cascade para restrição: `SetLog.exerciseId`, `WorkoutItem.exerciseId`, `WorkoutSession.workoutId`, `SetLog.sessionId`, `WorkoutSession.userId`, `Workout.userId`. `WorkoutItem.workoutId` continua cascade. | **Médio**: migration em FK; muda o comportamento de exclusão. |
| F1 (trade-off 3) | `PUT /workouts/:id`: filtrar por `userId` na própria escrita, dentro da transação. **Tarefa separada** do caso 1. | **Baixo**: muda a escrita do `update`; cobrir com teste de treino de outro usuário. |
| F4 | `targetSets` 1–20, `order` ≥ 0, `targetReps` 1–100 quando informado. Em `WorkoutItem`, `targetReps` passa a opcional e entra a duração-alvo em segundos (opcional) + migration. Pelo menos um dos dois obrigatório (decidido por delegação). Faixa da duração: `TODO(humano)`. | **Médio**: schema; requisições que hoje passam recebem 400. |
| F6 | Ao salvar item, conferir que o exercício existe e é do catálogo ou do próprio usuário; senão 400. (**Revisão em 2026-11-09**, ADR 0011; antes: só catálogo.) | **Baixo**: uma consulta a mais. |
| F9 | Campo de arquivamento em `Workout` (nulo = ativo) + migration; ação de arquivar e desarquivar; `GET /workouts` devolve só os ativos por padrão. | **Médio**: schema e contrato da listagem. |
| F10 | Limites de 10 treinos **ativos** por usuário (arquivados não contam) e 50 itens por treino; erro ao passar. **Só junto com F9**: nenhuma tarefa implementa F10 antes. | **Baixo** em si; **dependente de F9** (o limite de ativas precisa do campo de arquivamento). |
| F11 | Constraint única (`workoutId`, `order`) + migration. Lacunas permitidas. | **Médio**: a migration falha se já houver `order` repetido. |
| S1, S2 | **Implementado em 2026-11-10** (tarefa 2): `startedAt` enviado pelo aparelho e coluna `finishedAt`, com migration; as sessões existentes ficam com `finishedAt` nulo. Falta enviar `finishedAt` (rota de encerramento, tarefa 3). | **Alto** (reavaliado no plano da tarefa 2): migration sobre sessões existentes. |
| S3 | Uma sessão aberta por usuário. No sincronismo: aceitar todas, manter a de `startedAt` mais recente, encerrar as demais com `finishedAt = startedAt`, numa transação. | **Alto**: concorrência; índice parcial em SQL; regra de exceção. |
| S4 | **Implementado em 2026-11-11** (tarefa 3). Rejeitar treino sem itens só ao iniciar online. No `POST /sessions` (módulo `sessions`, na `main`). | **Baixo**. |
| S6 | No registro de série (módulo `sessions`; a rota ainda não existe), aceitar `failed` no body e gravar o valor recebido, sem calcular. Melhoria futura possível, não decidida: gravar em `SetLog` um snapshot de `targetReps` (exigiria schema e migration). | **Baixo**: nenhum código usa `SetLog` na `main`. |
| S5, S7 | **Implementado em 2026-11-10** (tarefa 2). `SetLog`: `weightKg` de `Float` para `Decimal(6,2)` opcional; `repsCompleted` opcional; duração em segundos opcional. | **Baixo**: nenhum código usa `SetLog` ainda; `Decimal` muda a serialização no JSON. |
| S8 | **Constraint implementada em 2026-11-10** (tarefa 2); o 409 e o lote do sincronismo ficam para as tarefas 3 e 17. Constraint única (`sessionId`, `exerciseId`, `setNumber`); 409 na duplicata; um conflito não derruba o lote do sincronismo. | **Baixo**: tabela sem uso por código. |
| S9 | **Implementado em 2026-11-11** (tarefa 3). Rotas de atualização por id para sessão e série; **sem rota de exclusão de sessão nem de série** (apagar exigiria marcador de exclusão no sincronismo); `finishedAt` preenchido não volta a vazio. | **Médio**: rotas novas com regras de posse; a ausência de exclusão é regra, não omissão. |
| (a) Offline | Endpoint de sincronismo; ids de sessão e série gerados no cliente; envio idempotente. Ver [ADR 0004](adr/0004-uso-offline-e-sincronizacao.md). | **Alto**: contrato novo, idempotência e concorrência. |
| (b) Catálogo inicial | Carga repetível do catálogo inicial curado (sem mídia). Fonte e tamanho: P1. | **Médio**: carga de dados; depende de P1. |
| Cardio | Ver S5, S7, F4 e E4. Ver [ADR 0006](adr/0006-cardio-no-v1-e-remocao-do-type.md). | incluído nas linhas acima |
| Exclusão de conta (C1) | Fluxo explícito, a pedido do titular, que apaga todos os dados do usuário. Numa transação: remove antes séries, sessões, programas (e seus dias), itens e treinos (FKs de restrição) e depois o usuário. Não apaga exercícios. Processo (canal e prazo): `TODO(humano)`. **Revisão em 2026-10-14** ([ADR 0009](adr/0009-catalogo-de-exercicios-fechado.md)). Antes: apagava também os exercícios do usuário (`Exercise.userId` em cascata). | **Alto**: apaga histórico de forma irreversível; interage com as FKs de restrição de C3; a ordem errada falha por violação de FK. (Antes também apagava exercícios; esse risco sai.) |
