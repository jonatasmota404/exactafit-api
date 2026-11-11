# Exacta Fit: produto, fases e tarefas

> Documento de produto (consolidação de 2026-11-09). As **regras** ficam em [`domain.md`](domain.md); a decisão de escopo, no [ADR 0011](adr/0011-app-generico-plano-e-dado.md). Em conflito, vale o `domain.md`. A ordem de execução está na seção 9.

Nov 9, 2026 · @Jônatas

## 1. Escopo decidido

- **App genérico.** Qualquer dieta e qualquer ficha de treino, definidas pelo usuário, de uma pessoa comum a um fisiculturista. Os dois PDFs (perfil A: déficit simples, 125 kg para 80 kg; perfil B: recomposição, 1,68 m e 67 kg) são **apenas modelos de exemplo**, carregados como dados que o usuário pode usar, copiar e editar. Nada de A/B, 4 refeições, prato de 4 peças ou regras de ajuste fica fixo no código.
- **Teste de generalidade:** a mesma engine representa o perfil A, o perfil B e um terceiro plano sem relação (por exemplo, push/pull/legs em 6 dias com superséries, 5 refeições e superávit), sem mudar código.
- **Uso individual ou em família.** O grupo (household) é opcional e toda feature funciona sem ele.
- **Assistente de criação opcional:** o app pode sugerir metas e estrutura a partir do perfil (fórmulas e modelos), mas o plano resultante é sempre dado editável.
- Por enquanto o único ambiente de treino é a academia: sem perfis de equipamento nem programa de casa. O usuário escolhe qualquer exercício.
- Decisões já tomadas: dicas de evento social só como dica opcional, sem contador negativo; ovos da lista de compras calculados do cardápio em cartelas de 30; meta de passos configurável por pessoa (nos modelos: A 8.000 a 10.000, B 7.000 a 9.000).
- Sempre privado: peso, medidas, fotos, ciclo, metas e sugestões. Compartilhado só o que é comida da casa: cardápio, prato cozinhado, visão da cozinha e lista de compras.
- Menores de 18 anos não recebem sugestões automáticas. O app não é dispositivo médico: sugere, e o usuário aceita ou recusa.

## 2. Estado atual da API

Verificado em `jonatasmota404/exactafit-api`, branch `main`, commit `23a714b` (clone raso; não rodei a API nem os testes).

**Stack:** NestJS 11, Prisma 7 com Postgres, JWT, bcrypt, class-validator. Há Dockerfile, docker-compose, CI em `.github/workflows/ci.yml` e documentação em `docs/` (domain.md, ADRs 0001 a 0010, planos).

**Front: não encontrado.** Não existe repositório de front do Exacta Fit na conta (o `exacta-next` é o sistema da retífica). Não há PWA, tela, offline nem lembrete.

| Rota | Arquivo | Observação |
| --- | --- | --- |
| `GET /` | `src/app.controller.ts` | rota básica |
| `POST /auth/register`, `POST /auth/login` | `src/auth/auth.controller.ts` | JWT de 7 dias |
| `GET /exercises`, `POST /exercises` | `src/exercises/exercises.controller.ts` | lista tudo, sem filtro; qualquer usuário autenticado cria exercício |
| `POST /workouts`, `GET /workouts`, `GET /workouts/:id`, `PUT /workouts/:id` | `src/workouts/workouts.controller.ts` | treinos do próprio usuário (eram `/routine`, fichas, até a tarefa 6) |
| `POST /sessions` | `src/sessions/sessions.controller.ts` | só recebe `workoutId` (era `routineId`); `startedAt` é `now()` do servidor |

**Schema (`prisma/schema.prisma`), 6 modelos (histórico, antes das tarefas 2 a 6; `WorkoutRoutine` e `RoutineItem` hoje são `Workout` e `WorkoutItem`):** `Exercise` (name, muscleGroup, type), `User`, `WorkoutRoutine`, `RoutineItem` (targetSets e targetReps inteiros, sem faixa), `WorkoutSession` (só startedAt), `SetLog` (weightKg Float, repsCompleted, failed).

**Decidido em `docs/domain.md` mas não implementado:** `finishedAt` na sessão; duração para cardio; carga Decimal(6,2) e opcional; remover `Exercise.type`; `muscleGroup` restrito aos 10 valores do dataset; `order` único por ficha; arquivar fichas; usuário desativado com checagem no guard; normalizar e-mail; ids gerados no cliente e sincronismo (ADR 0004); carga do dataset de exercícios (ADR 0005). **Não há rota para gravar série nem para encerrar sessão.** O catálogo de exercícios está vazio: não há script de carga nem seed.

**Conflito de escopo:** o domain.md diz que alimentação está fora do V1, sem schema nem regras, e lista "ficha por IA" no V1 com o serviço ainda indefinido. Ele precisa ser revisto antes de qualquer plano de implementação, porque manda os agentes não presumirem regras que não estão nele.

**Conflito com a generalidade:** o catálogo de exercícios é fechado (regras E1 e E2, ADR 0009: usuário não cria exercício), e a ficha atual tem repetição única, sem tipo de série, superssérie nem ciclo de dias além da semana. Um app genérico precisa reabrir essa decisão e permitir exercício próprio do usuário.

## 3. O que falta

Esforço P/M/G. Risco B/M/A.

| Área | Existe hoje | Falta | Esf. | Risco |
| --- | --- | --- | --- | --- |
| Conta e perfil | `User`, register, login, guard JWT | sexo, nascimento, altura, fuso, ativo/inativo; guard que confere usuário ativo | M | M |
| Household opcional | nada | `Household`, `HouseholdMember`, convite por código, sair sem perder dados, isolamento por usuário | M | A |
| Dieta: estrutura do plano | nada | refeições configuráveis (quantas e quais), metas de kcal, proteína, carboidrato e gordura por tipo de dia e por refeição | G | M |
| Base de alimentos | nada | macros por 100 g, estado cru ou pronto, tags de restrição, edição e importação por CSV | M | B |
| Composição e porção | nada | refeição livre ou por componentes; porção calculada a partir de qualquer meta (kcal, proteína, carboidrato); funciona offline | M | B |
| Registro e tela Hoje | nada | `MealLog` com snapshot de macros, estado do dia, consulta única para Hoje | M | M |
| Cardápio, receitas e compras | nada | receitas do usuário, rotação opcional, lista da semana com rendimento cru para pronto, ovos em cartelas de 30, visão da cozinha | M | M |
| Modelos (os PDFs) | nada | carga como dados: metas, receitas, prato e regras dos perfis A e B, usar e copiar modelo | P | B |
| Modo balança e evento | nada | passo a passo de pesagem; modo evento com dicas opcionais e botão "saí do plano" | P | B |
| Peso, medidas, fotos, ciclo | nada | `BodyMetric`, `ProgressPhoto`, `CycleLog`; peso oculto por escolha, aplicado na API | M | A |
| Revisão e ajustes | nada | tipos de regra parametrizados (variação de ritmo, estagnação, piso e teto), ação sobre a meta, `Suggestion` com aceite e recusa, pisos e alertas de saúde; presets A e B | G | A |
| Assistente de criação | nada | fórmulas determinísticas de gasto e metas a partir do perfil, recusa de menores | M | M |
| Hábitos | nada | passos, água, sono, caminhada, placar semanal sem sequência que zera | P | B |
| Treino: programa genérico | `WorkoutRoutine`, `RoutineItem` (ficha avulsa, repetição única) | `Program` com ciclo semanal por dia ou rotativo de N dias e alternância por semana; tipos de série (aquecimento, normal, falha, drop), superssérie, faixa de repetições, tempo ou por lado, descanso, RIR ou RPE | G | M |
| Treino: progressão e fases | nada | regra no item do treino (dupla, linear, nenhuma), blocos definidos pelo usuário, semana leve a cada N semanas | M | B |
| Treino: log | `SetLog` só no schema | rotas de série e encerramento, Decimal, duração, ids do cliente, última carga, sugestão da próxima, cronômetro | M | M |
| Catálogo de exercícios | tabela sem dados; domain.md proíbe exercício do usuário | carga dos exercícios iniciais, reabrir o ADR 0009 para exercício próprio e privado, restringir `POST /exercises` | M | M |
| Importar e exportar plano | nada | JSON de dieta e de programa | P | B |
| Offline e sincronismo | decisão no ADR 0004 | endpoint idempotente, fila local, token vencido offline | G | A |
| Front PWA | nada | repositório, Hoje, prato, treino, editores de plano, instalável, offline-first | G | A |
| Lembretes | nada | push ou alternativa; limite no iOS (app instalado na tela inicial) | M | A |
| Privacidade e avisos | JWT, bcrypt, validação com whitelist | isolamento por usuário e casa, backup, sem dados de saúde em log, textos fixos de aviso médico | M | A |

## 4. Modelo de dados: mudanças

**Princípio:** o plano é dado, não código. Dieta e treino são estruturas configuráveis; os PDFs entram como linhas nessas tabelas.

**Dieta (novas):** `DietPlan`, `MealSlot` (quantas refeições e com que nome o usuário quiser), `DayTarget` (metas de kcal, proteína, carboidrato e gordura por tipo de dia e por refeição), `Food` (macros por 100 g, estado cru ou pronto, tags), `FoodYield`, `MealTemplate` (composição livre ou por componentes, com meta por componente), `PlannedMeal`, `PlannedMealItem`, `MealLog` e `MealLogItem` (com snapshot dos macros). A porção de qualquer item sai da meta escolhida (kcal, proteína ou carboidrato) dividida pelo valor por 100 g.

**Treino (novas):** `Program` (ciclo semanal por dia da semana ou rotativo de N dias, com alternância por semana opcional), `ProgramDay`, `Workout`, `WorkoutItem` (substitui `RoutineItem`: série normal, aquecimento, até a falha ou drop; faixa de repetições, tempo ou por lado; descanso; grupo de superssérie; RIR ou RPE opcional; regra de progressão dupla, linear ou nenhuma, com passo percentual, decisão (d)), `Phase` (blocos definidos pelo usuário e semana leve a cada N semanas).

**Acompanhamento e regras (novas):** `BodyMetric`, `ProgressPhoto`, `CycleLog`, `DayLog`, `ReviewRule` (tipos parametrizados com janela, limite e ação sobre a meta), `Suggestion` (aceita ou recusada), `PlanTemplate` (os PDFs e outros modelos), `Household`, `HouseholdMember` e `PushSubscription`.

**Alteradas:** `User` (perfil e `householdId` opcional); `Exercise` (remover `type`, id do dataset, dono opcional para exercício do usuário); `WorkoutRoutine` e `RoutineItem` (renomeados para `Workout` e `WorkoutItem` na tarefa 6, [ADR 0014](adr/0014-ficha-vira-treino.md): as fichas viram treinos e o `Program` os organiza no ciclo); `WorkoutSession` (`finishedAt`, ids do cliente); `SetLog` (`weightKg` Decimal opcional, `durationSeconds`, tipo de série, ids do cliente).

**Rotas novas:** CRUD de `/diet-plans` e `/programs`, `/templates` (usar e copiar um modelo), exportar e importar plano em JSON, `/me/profile`, `/foods`, `/meal-logs`, `GET /today`, `/metrics`, `PATCH /sessions/:id`, `/sessions/:id/sets`, `GET /exercises/:id/last-performance`, `POST /sync`, `/suggestions`, `/shopping-list`, `/kitchen` e `/households`.

## 5. Fases e critérios de aceite

**Fase 1: menor MVP usável pelos dois (Hoje, montador de prato, log de treino)**

1. Os dois PDFs estão carregados como modelos (dados). Usar o modelo do perfil A dá cerca de 2.400 kcal, 165 g de proteína e prato de 200 g de proteína e 190 kcal de carboidrato; o do B, cerca de 1.900 kcal, 140 g e prato de 150 g e 150 kcal, com divisão 340/615/310/615.
2. Teste do fisiculturista, sem código novo: criar um programa de 6 dias (push/pull/legs duas vezes) com superssérie, série drop e um exercício próprio, e uma dieta de 5 refeições com metas de kcal, proteína, carboidrato e gordura. Hoje e o log funcionam com ele.
3. A porção sai de qualquer meta escolhida: arroz a 130 kcal/100 g dá cerca de 146 g para alvo 190 e cerca de 115 g para alvo 150, sem rede.
4. Hoje mostra as refeições do plano ativo, o treino do dia conforme o ciclo do programa (por dia da semana com alternância A-B por semana, ou rotativo de N dias) ou a caminhada, e os passos, marcáveis com um toque.
5. Em modo avião: registrar 3 séries, recarregar, os dados permanecem; ao voltar a rede sincroniza sem duplicar (enviar o lote duas vezes).
6. Ao abrir o exercício aparecem a carga anterior e a sugestão conforme a regra de progressão do item (dupla: sobe o passo do item, de 1 a 10%, quando o máximo da faixa foi feito em todas as séries).
7. Sem household todas as telas funcionam; com household a cozinha mostra as duas porções e nenhum usuário vê peso, medidas ou fotos do outro (teste de acesso cruzado).

**Fase 2: acompanhar e ajustar.** Medidas, fotos, ciclo, peso oculto por escolha do usuário, média de 4 semanas, regras de revisão configuráveis com aceite e recusa (um teste por regra; presets A e B), pisos nas sugestões automáticas (o modelo do B nunca abaixo de 1.700 kcal), alertas de saúde, pausa de dieta como sugestão, placar semanal e o assistente de criação de plano a partir do perfil (fórmulas determinísticas).

**Fase 3: dia a dia.** Visão da cozinha, lista de compras com rendimento cru para pronto e ovos em cartelas, modo evento e modo balança, lembretes, hábitos.

**Fase 4: fases do programa.** Adaptação, progressão e manutenção, semana leve automática.

## 6. Decisões

**Já tomadas:** itens da seção 1.

**Adotadas em 2026-11-09** (o humano mandou seguir com a recomendação deste documento; no `domain.md` aparecem como `DECIDIDO (por delegação)`):

1. Regras de revisão só como tipos parametrizados (variação de ritmo, estagnação, piso e teto), sem linguagem de regras livre.
2. ADR 0009 reaberto: exercício próprio e privado do usuário ([ADR 0011](adr/0011-app-generico-plano-e-dado.md)).
3. Kcal, proteína, carboidrato e gordura por padrão; fibra opcional.
4. Plano do usuário fora do piso: avisa, mas permite; sugestão automática nunca cruza o piso. Piso genérico: 1.700 kcal para mulheres, gasto basal estimado para homens.
5. Assistente de criação determinístico, sem IA em tempo de execução.
6. `docs/domain.md` revisado (alimentação no escopo, household opcional, engine genérica).
7. Front em PWA ([ADR 0012](adr/0012-front-pwa.md)).

**Ainda em aberto** (cada uma bloqueia só a tarefa indicada; ver "Decisões pendentes" no `domain.md`):

- P1: fonte e tamanho da carga inicial do catálogo de exercícios (tarefa 5).
- P2: fotos no servidor ou só lembrete (Fase 2).
- P3: Android ou iPhone de cada um, por causa dos lembretes (Fase 3).
- P4: supino inclinado do perfil B, "2 ×" é 2 séries ou 2 vezes por semana (modelo B, tarefa 14).

## 7. Riscos

- **Sincronismo offline** é a parte mais frágil (duplicatas, relógio do aparelho, token de 7 dias que pode vencer offline).
- **Dados de saúde sensíveis** (peso, medidas, fotos, ciclo) de duas ou mais pessoas: isolamento, backup e nada em log. Esconder o peso do B só na tela é frágil; a API não deve devolvê-lo por padrão.
- **Regras de ajuste de calorias** são recomendações de saúde: código determinístico e versionado, sempre com aceite do usuário e avisos fixos.
- **Notificações em PWA no iOS** só funcionam com o app instalado e permissão dada em um toque.
- **Esteira de IA do repositório** (kit 1.2): risco baixo vai direto ao PR; médio pede só os critérios de aceite aprovados na conversa; alto pede também plano em `docs/plans/`. Tarefa que passar de ~300 linhas de código de produção é dividida no planejamento.

## 8. Fora do escopo agora

Ficha de treino gerada por IA em tempo de execução, os 1.324 exercícios do dataset e a mídia, importação inteira da TACO (a base começa curada e editável), papéis de professor e academia, venda para terceiros, treino de casa e perfis de equipamento, ajuste automático por ciclo e linguagem de regras livre.

## 9. Fase 1 em tarefas (ordem de execução)

Cada linha é uma tarefa, uma branch e um PR. O risco segue a tabela "Risco: quem decide o quê" do `AGENTS.md`: **baixo** vai direto ao PR; **médio** começa com `planejar-tarefa` (critérios aprovados na conversa); **alto** pede também plano em `docs/plans/`. "Critério" aponta para os critérios da Fase 1 (seção 5).

| # | Tarefa | Regras | Critério | Risco | Depende de |
|---|---|---|---|---|---|
| 1 | Auditoria do módulo `sessions`: testes de caracterização (plano já escrito em `docs/plans/2026-10-19-auditoria-sessions.md`) | S1–S9 | — | baixo (só testes) | — |
| 2 | Schema do log de treino: `finishedAt`, `weightKg` Decimal opcional, `durationSeconds`, ids gerados no cliente, constraint de S8, FKs de restrição | S1, S2, S5, S7, S8, C2, C3 | 5 | alto | 1 |
| 3 | Rotas de série e de encerramento: `/sessions/:id/sets`, `PATCH /sessions/:id`, correção sem exclusão | S3, S4, S9 | 5 | médio | 2 |
| 4 | Exercício próprio e privado: dono em `Exercise`, `GET` com catálogo + próprios, `POST` cria próprio | E1, E2, F6 | 2 | alto | — |
| 5 | Carga do catálogo inicial curado | (b) | 2 | médio | 4, **P1** |
| 6 | A ficha vira treino: renomear `WorkoutRoutine`/`RoutineItem` para `Workout`/`WorkoutItem` (banco, código e rotas `/workouts`), FKs `Workout.userId` e `WorkoutItem.exerciseId` em `RESTRICT`, e schema `Program` e `ProgramDay` (sem rota) | (d), F, C3 | 2, 4 | alto | 4 |
| 7a | CRUD `/programs` (ciclo semanal ou rotativo, ativação com um programa ativo por usuário, dia só com treino do dono, limites do ciclo). Plano: `docs/plans/2026-11-11-programas-crud.md`. **Feito em 2026-11-11** | (d) | 2, 4 | alto | 6 |
| 7b | Campos novos do item do treino (tipo de série, faixa de repetições, tempo ou por lado, descanso, superssérie, RIR/RPE), com migration. Plano: `docs/plans/2026-11-11-item-do-treino.md`. **Feito em 2026-11-11** | (d) | 2, 4 | alto | 7a |
| 8 | Progressão no item (`progressionType`, `progressionStepPercent`) e `GET /exercises/:id/last-performance` com a sugestão. Plano: `docs/plans/2026-11-11-progressao.md`. **Feito em 2026-11-11** | (d) | 6 | alto | 3, 7b |
| 9 | Perfil do usuário (`/me/profile`: sexo, nascimento, altura, fuso) e usuário ativo no guard. Plano: `docs/plans/2026-11-11-perfil-e-usuario-ativo.md`. **Feito em 2026-11-11** | C1, (e) | — | alto | — |
| 10a | Alimentos: `Food` e `/foods` (catálogo + próprios, filtros, soma de nutrientes até 100 g). Plano: `docs/plans/2026-11-11-alimentos.md`. **Feito em 2026-11-11** | (c) | 2, 3 | alto | — |
| 10b | `FoodYield` (rendimento cru para pronto) e importação por CSV (tudo ou nada) | (c) | 2, 3 | alto | 10a |
| 11 | Plano de dieta: `DietPlan`, `MealSlot`, `DayTarget`, `MealTemplate`, `/diet-plans` | (c) | 2 | alto | 10 |
| 12 | Cálculo da porção como função pura, sem rede (o front reutiliza) | (c) | 3 | baixo | 10 |
| 13 | Registro de refeição: `MealLog` e `MealLogItem` com snapshot dos macros | (c), inv. 16 | 4 | alto | 11 |
| 14 | Modelos: `PlanTemplate`, carga dos perfis A e B, `/templates` (usar e copiar) | inv. 15 | 1 | médio | 7a, 7b, 11, **P4** (só o B) |
| 15 | `GET /today`: refeições do plano ativo, treino do dia pelo ciclo, passos | (c), (d), (e) | 4 | médio | 7a, 13 |
| 16 | Household: `Household`, `HouseholdMember`, convite por código, visão da cozinha, teste de acesso cruzado | (f), inv. 12, 13 | 7 | alto | 11, 13 |
| 17 | `POST /sync` idempotente (enviar o lote duas vezes não duplica) | (a), S3, S8 | 5 | alto | 3 |
| 18 | Front PWA: repositório novo com o kit, Hoje, prato, treino e editores, offline-first | ADR 0012 | 4, 5 | alto | 3, 7a, 7b, 11, 12 |

Tarefas sem dependência entre si (por exemplo 4, 9 e 10) podem andar em paralelo, cada uma na própria branch a partir da `main`. A Fase 2 em diante é quebrada do mesmo jeito quando a Fase 1 fechar.
