# Plano: auditoria do módulo `sessions` contra S1–S9 (fila 4), antes do deploy

> O humano aprova antes de o `implementador` começar. O plano preenchido, com o "Resultado" ao concluir, é o registro da tarefa.

Aprovado por: —
Modelo recomendado: Opus 5.5 (o da sessão) — auditoria com julgamento de regra de negócio; não toca zona de risco de código; não pede troca de modelo.

## Intenção
Fixar por testes de caracterização o comportamento atual de `sessions` (entrou no PR #18 sem plano, sem revisão e sem testes) e confrontá-lo com S1–S9 e com o ADR 0004, com os achados priorizados e uma proposta de correção para cada um. **Nada é corrigido nesta tarefa.** Responde às perguntas do humano: a API gera o id da sessão (o cliente não pode enviar), e **um reenvio duplica a sessão**.

## Diagnóstico (lido no código da `main` `6e2eedd`; não verificado em execução, os testes da tarefa 1 verificam)

### 1. Inventário do módulo
| Peça | Onde | O que faz |
|---|---|---|
| Módulo | `src/sessions/sessions.module.ts:5-8` | registra controller e service; importado em `src/app.module.ts:8,16` |
| Rota única | `src/sessions/sessions.controller.ts:13-21` | `POST /sessions`; `@UseGuards(AuthGuard)` no controller (linha 14); `userId = req['user'].sub` (linha 19) |
| DTO | `src/sessions/dto/create-session.dto.ts:3-7` | só `routineId`: `@IsNotEmpty()` e `@IsUUID('4', { message: 'Preciso de um UUid válido' })` |
| Service | `src/sessions/sessions.service.ts:9-25` | `workoutRoutine.findFirst({ id, userId })` → 404 `Ficha de treino não encontrada`; depois `workoutSession.create({ userId, routineId })` |
| Pipe global | `src/main.ts:7-13` | `whitelist` + `forbidNonWhitelisted` + `transform`: campo extra no body → 400 |
| Banco | `prisma/schema.prisma:75-87` (`WorkoutSession`) | `id @default(uuid())` (gerado pela API); `startedAt @default(now())`; **sem `finishedAt`**; FKs `userId` e `routineId` com `onDelete: Cascade`; sem índice de sessão aberta |
| Banco | `prisma/schema.prisma:89-104` (`SetLog`) | `weightKg Float` e `repsCompleted Int` **obrigatórios**; sem duração; **sem unique** (`sessionId`, `exerciseId`, `setNumber`); FKs em cascata. Nenhum código usa |
| Testes | `src/sessions/*.spec.ts` | só "should be defined" (controller e service com mocks vazios). **Nenhum e2e** (`ls test` não tem sessions; o `test/session.e2e-spec.ts` do commit `e7300a8` não está na `main`) |

Não existem: `GET`, `PUT`/`PATCH`, `DELETE` de sessão; nenhuma rota de série (`SetLog`); endpoint de sincronismo.

### 2. Regra a regra
Veredito: **conforme**, **divergente** (o código faz outra coisa), **não implementada** (não há código), **ambígua** (vira `CONFIRMAR(humano)` nas perguntas).

| Regra | O que diz (resumo de `docs/domain.md`) | Onde o código está | Teste hoje | Veredito |
|---|---|---|---|---|
| S1 | Sessão pertence a usuário e ficha. `startedAt`/`finishedAt` vêm do aparelho, sem validação, UTC. Ficha arquivada é aceita | dono e ficha: `sessions.service.ts:10-23` (conforme). `startedAt`: `schema.prisma:79` `now()` do servidor; o DTO recusa `startedAt` (400 por `forbidNonWhitelisted`) | nenhum | **divergente** (data); dono/ficha conforme. "Ficha arquivada": F9 não existe, não se aplica agora |
| S2 | `finishedAt` opcional; vazio = aberta | campo não existe | nenhum | **não implementada** |
| S3 | No máximo uma sessão aberta por usuário; exceção do sincronismo (fica a de `startedAt` mais recente) | nada: cada `POST` cria uma sessão nova, e sem `finishedAt` todas ficam "abertas" | nenhum | **não implementada**. Comportamento online da segunda sessão: **ambígua** (P2) |
| S4 | Ficha sem itens não inicia sessão **ao iniciar online**; o sincronismo aceita | `sessions.service.ts` não confere itens; `CreateRoutineDto` aceita `items: []` (`create-routine.dto.ts:25-28`) | nenhum | **divergente** (ficha vazia inicia sessão). Como a API distingue "online" de "sincronismo": **ambígua** (P1) |
| S5 | Série: `setNumber`, `failed` (padrão `false`), exercício; reps, carga e duração opcionais; ids de sessão e série gerados no cliente | sem rota de série; `SetLog` com reps e carga obrigatórias, sem duração; `WorkoutSession.id` gerado pela API e o DTO recusa `id` | nenhum | **não implementada** (séries) e **divergente** (id da sessão) |
| S6 | `failed` informado pelo usuário, sem conferência | `SetLog.failed @default(false)` existe; sem rota | nenhum | **não implementada** (schema já serve) |
| S7 | Carga em kg, `Decimal(6,2)`, vazia = peso do corpo | `weightKg Float` obrigatório | nenhum | **não implementada** (schema divergente, sem uso) |
| S8 | `setNumber` único por sessão e exercício (constraint; 409); série de exercício fora da ficha aceita se existir no catálogo | sem constraint, sem rota | nenhum | **não implementada** |
| S9 | Corrige sessão e série por id; nunca apaga; sessão encerrada não reabre | não há rota de atualização; **não há rota de exclusão** (a ausência é a regra) | nenhum | exclusão: **conforme** (por ausência). Atualização e "não reabre": **não implementadas** |

Fatos desatualizados em `docs/domain.md` (não são regra, são descrição do código): o título da seção diz "Sessões e séries (só schema; nenhum código usa ainda)" (`docs/domain.md:115`), e as linhas de S4 e S6 em "Mudanças de código decorrentes" (`:198-199`) citam `wip/sessions`; o código está na `main` desde o PR #18.

### 3. Autorização (IDOR), por rota
- `POST /sessions`: `userId` vem do token (`sessions.controller.ts:19`), não do body (campo `userId` no body → 400 pelo pipe global). A ficha é buscada com `{ id, userId }` (`sessions.service.ts:10-15`): ficha de outro usuário → 404, igual à ficha inexistente (mesma escolha de F1). **Conforme.** O teste confirma também que nada é gravado nesse caso.
- Não há rota que leia ou altere sessão existente, então não há outra superfície de IDOR hoje. Quando existirem (S9, sincronismo), toda query de sessão precisa filtrar por `userId` (convenção do `AGENTS.md`); isso entra como critério dos planos de correção (achados A1 e A5).
- Detalhe técnico, sem efeito hoje: `findFirst` e `create` estão fora de transação. A única corrida seria apagar a ficha entre os dois, e não existe rota que apague ficha.

### 4. Idempotência e reenvio
- **A API gera o próprio id** (`schema.prisma:76` `@default(uuid())`) e **recusa id do cliente** (o DTO não tem `id`; com `forbidNonWhitelisted`, `{ id, routineId }` → 400).
- **Reenvio duplica:** o mesmo `POST` repetido (o PWA reenviando depois de um timeout em que a primeira chegou) cria uma segunda sessão com outro id. Não há chave natural nem constraint para impedir. Escritas concorrentes têm o mesmo efeito (duas linhas), já que não há leitura de "sessão aberta" para disputar.
- Isso contraria o ADR 0004 ("o envio pode repetir sem duplicar"; "nenhuma regra nova pode depender de a API gerar o id de sessão ou série") e S5.
- **Abordagem recomendada para o plano de correção** (decisão de contrato, cabe ao humano; ver P3):
  - **A (recomendada): id gerado pelo cliente no body, idempotente pela chave primária.** O `POST` recebe `id` (UUID). Se ele não existe, a API cria (201). Se já existe e é do mesmo usuário, devolve a sessão gravada (200), sem alterar nada. Se existe e é de outro usuário, devolve 409. A PK resolve concorrência e reenvio sem tabela nova (o perdedor da corrida pega a violação de unicidade e cai no caso "já existe"). Custos: o reenvio com corpo diferente devolve o original em silêncio; o 409 revela que um UUID existe (risco desprezível com UUID aleatório). Reversível enquanto não houver cliente em produção.
  - **B: cabeçalho `Idempotency-Key` + tabela de chaves.** É genérico, mas pede schema novo, expiração e outra regra. Descartada por excesso para um só uso.
  - **C: manter o id do servidor e deixar a idempotência só para o endpoint de sincronismo.** É o menor esforço agora, mas contraria o ADR 0004, e o PWA reenvia também quando está online. Descartada.

### 5. Validação e erros (consistência com o resto da API)
| Entrada | Status hoje (lido) | Padrão do resto da API | Observação |
|---|---|---|---|
| sem token | 401 (`AuthGuard`) | igual | conforme |
| `routineId` ausente ou não UUID | 400 | 400 (DTO + pipe global) | mensagem própria em PT com erro de digitação ("UUid") e `@IsUUID('4')`; `routines` usa `@IsUUID()` sem versão e as mensagens padrão do class-validator. Baixo |
| campo extra (`id`, `userId`, `startedAt`, `finishedAt`) | 400 | igual (pipe global) | é o que impede o id do cliente (achado A1) |
| ficha inexistente ou de outro usuário | 404 | 404 (F1) | conforme |
| duplicata | não existe (cria outra) | 409 em `auth` (e-mail) e previsto em S8 | o 409 entra com A1/A4 |
| resposta 201 | `{ id, userId, routineId, startedAt }` | `routines` também devolve `userId` | conforme o padrão atual |

## Achados priorizados (sem corrigir nada aqui)
| # | Achado | Regras | Risco | Proposta de correção (plano próprio) |
|---|---|---|---|---|
| A1 | Reenvio e concorrência duplicam a sessão; a API gera o id e recusa o do cliente | S5, ADR 0004 | **alto** (o PWA reenvia; histórico duplicado é dado sujo e difícil de limpar) | abordagem A da seção 4: `id` UUID no `CreateSessionDto`; criar ou devolver a existente; 409 para id de outro usuário. Depende de P3 |
| A2 | Sem `finishedAt` e sem a regra de uma sessão aberta: toda sessão fica aberta para sempre | S2, S3, invariante 4 | **alto** (não dá para encerrar treino; invariante violada desde a primeira sessão) | migration com `finishedAt` opcional e índice único parcial (`user_id` onde `finished_at` é nulo); comportamento online da segunda sessão conforme P2; exceção do sincronismo na tarefa do sincronismo. Já previsto em "Mudanças de código decorrentes" (S1, S2, S3: risco alto) |
| A3 | `startedAt` é `now()` do servidor e o cliente não pode enviá-lo | S1 | **médio** (o treino offline fica com a hora do envio) | `startedAt` (e `finishedAt`) opcionais no DTO, ISO 8601, sem validação de faixa (S1 opção B). O que fazer quando faltar: P4 |
| A4 | Ficha sem itens inicia sessão | S4 | **médio** (regra de produto descumprida, sem dano a dado) | recusar no início online; qual status (400 ou 409) e como reconhecer o "online": P1 |
| A5 | Sem rotas de série, de atualização de sessão e de leitura | S5–S9 | **médio** (o front não registra séries; não há bug, falta funcionalidade) | planos próprios, já previstos em "Mudanças de código decorrentes" (S5, S7, S8, S9); toda query filtra por `userId` |
| A6 | `SetLog` diverge do schema decidido (`Float` obrigatório, `repsCompleted` obrigatório, sem duração, sem unique) | S5, S7, S8 | **médio** (barato agora, sem dados; caro depois) | migration única antes da primeira rota de série |
| A7 | FKs de sessão e série em cascata | C2, C3 | **baixo hoje** (nenhuma rota apaga ficha nem usuário) | já está na linha E6/C2/C3 das "Mudanças"; fazer antes de qualquer `DELETE` ou da exclusão de conta |
| A8 | `domain.md` descreve sessions como "só schema" e `wip/sessions` | — | **baixo** (doc engana o próximo plano) | corrigir nesta tarefa (tarefa 2), sem mudar regra |
| A9 | `@IsUUID('4')` com mensagem própria ("Preciso de um UUid válido"), diferente de `routines` | — | **baixo** (inconsistência; recusaria UUID v7 se o cliente gerar ids nesse formato no futuro) | alinhar a `@IsUUID()` com a mensagem padrão no plano de A1 |
| A10 | Specs unitárias só testam "should be defined" | — | **baixo** (a cobertura real fica no e2e desta tarefa) | nenhuma ação; a caracterização cobre |

Ordem sugerida para os planos de correção: A1+A3+A9 (contrato do `POST`) → A2 → A4 → A6 → A5. O A2 vem logo depois do A1 porque o índice parcial e a regra de S3 dependem de `finishedAt`.

## Critérios de aceite
- [ ] `test/sessions-caracterizacao.e2e-spec.ts` existe e passa num Postgres descartável, com os blocos "conforme domain.md" e "comportamento atual (diverge de domain.md)", no padrão de `test/routines-caracterizacao.e2e-spec.ts`.
- [ ] Os testes cobrem cada linha da tabela "Testes" abaixo.
- [ ] `npm run test:e2e` inteiro passa no mesmo banco descartável (as suítes antigas continuam verdes).
- [ ] `docs/domain.md` deixa de dizer que sessions é "só schema" ou `wip/sessions` (A8), sem mudar nenhuma regra nem status.
- [ ] `git diff --stat main...HEAD` lista só `test/sessions-caracterizacao.e2e-spec.ts`, `docs/domain.md`, `docs/plans/2026-10-19-auditoria-sessions.md`, `docs/RETRO.md` e `AGENTS.md`; `git diff main...HEAD -- src prisma package.json package-lock.json .github .claude` vazio.
- [ ] Typecheck, testes unitários e lint passam.

## Testes (escritos antes do código)
A tarefa não muda comportamento: os testes de caracterização são o entregável e travam o comportamento **atual**, inclusive o que diverge de `domain.md`. Cada divergente quebra de propósito quando o achado for corrigido; o plano de correção troca a expectativa e declara `Teste alterado: <motivo>`. Sem teste de schema de `SetLog` (S5–S8): não há rota que o exercite, e testar a tabela direto seria detalhe interno; a evidência é `prisma/schema.prisma:89-104`.

Arquivo: `test/sessions-caracterizacao.e2e-spec.ts`. Setup igual ao de `routines-caracterizacao`: dois usuários (A e B) via `/auth/register` + `/auth/login`, um exercício criado via Prisma, fichas via `POST /routine`; `afterAll` apaga usuários (sessões e fichas saem pela cascata de hoje) e o exercício.

| Bloco | Caso (entrada → esperado hoje) | Regra |
|---|---|---|
| conforme | `POST /sessions` sem token → 401 | autenticação |
| conforme | A, ficha própria com item → 201, `{ id, userId, routineId, startedAt }`, `userId` = A; a linha existe no banco | S1 (dono e ficha) |
| conforme | A, ficha de B → 404, e nenhuma sessão gravada para a ficha de B | IDOR, F1 |
| conforme | A, `routineId` UUID v4 inexistente → 404 | — |
| conforme | `routineId` ausente → 400; `routineId: 'abc'` → 400 | validação |
| conforme | body com `userId` de B → 400, e nada gravado | `userId` só do token |
| conforme | `DELETE /sessions/:id` → 404 (rota não existe) | S9 (nunca apaga) |
| diverge | body com `id` UUID do cliente → 400 | S5, ADR 0004 (A1) |
| diverge | mesmo body enviado duas vezes → dois 201 com ids diferentes; duas sessões no banco | ADR 0004, S3 (A1, A2) |
| diverge | duas sessões seguidas sem encerrar → ambas gravadas, nenhuma com `finishedAt` (a chave não existe na resposta) | S2, S3 (A2) |
| diverge | body com `startedAt` → 400; sem ele, `startedAt` fica entre o instante antes e o depois da requisição (relógio do servidor) | S1 (A3) |
| diverge | body com `finishedAt` → 400 | S2 (A2) |
| diverge | ficha com `items: []` → 201 | S4 (A4) |
| diverge | `GET /sessions`, `GET /sessions/:id`, `PUT /sessions/:id`, `PATCH /sessions/:id` → 404 (rotas não existem) | S9 correção por id (A5) |

Concorrência (`Promise.all` de dois `POST`): **sem teste próprio**, decidido por padrão. Sem constraint nem leitura prévia de sessão aberta, o resultado é o mesmo do reenvio sequencial; o teste entra no plano de A1/A2, quando houver corrida real a provar.

Risco desta tarefa: baixo, mas o humano aprova esta lista junto com o plano, porque ela define o que fica travado.

## Risco
- **Nível:** baixo (só teste e documentação; nenhum código de produção, schema ou dependência).
- **Toca zona de risco?** Não. Não toca `src/auth/`, `prisma/`, `package.json`, `.github/workflows/` nem `.claude/`. O teste **usa** o `AuthGuard` e `/auth/*` como caixa-preta. Executa `npx prisma migrate deploy` **só no Postgres descartável** (comando de zona de risco: confirmação pedida aqui, na aprovação do plano).
- **O que pode quebrar:** nada em produção. Riscos operacionais: (1) rodar o e2e no banco de desenvolvimento (5433) por engano; mitigado pela `DATABASE_URL` inline com a porta descoberta na hora e pela conferência da porta antes de rodar. (2) O teste cria exercício com `type: 'strength'`, como os outros e2e; ele quebra junto com eles na migration de E4 (fila 8), o que é esperado. (3) O `afterAll` depende da cascata `User → sessões`; quando A7 virar restrição, a limpeza muda no plano de A7.

## Menor esforço
Menor esforço: considerei (1) só o relatório, sem teste; (2) relatório + caracterização e2e; (3) corrigir junto. Escolhi (2): o pedido proíbe corrigir; sem teste, a auditoria não trava nada e o próximo plano não tem linha de base; e o e2e reaproveita o setup de `routines-caracterizacao` sem helper novo.

## Segurança (risco médio ou alto)
Não se aplica como controle desta tarefa: risco baixo, só teste e documentação. A análise de segurança do módulo (IDOR, `userId` do token, entrada externa, idempotência) está no diagnóstico, seções 3 a 5, e vira critério dos planos de correção. O A1 (risco alto) pede a skill `seguranca` no plano dele.

## Tarefas (um commit cada)
1. `test(sessions): caracterização do POST /sessions contra S1–S9`: cria `test/sessions-caracterizacao.e2e-spec.ts` com a tabela "Testes"; roda no Postgres descartável. Se algum caso "lido no código" se mostrar diferente na execução, o teste trava o que **acontece**, e a divergência vai para o "Resultado" (não se corrige o código).
2. `docs(domain): sessions existe na main (POST /sessions)`: só o título da seção (`docs/domain.md:115`) e as referências a `wip/sessions` (`:198-199`); nenhuma regra ou status muda. No mesmo commit, `AGENTS.md` ("Cuidados conhecidos") passa de "auditoria pendente" para "auditado; achados em `docs/plans/2026-10-19-auditoria-sessions.md`, correções pendentes antes do deploy".
3. `docs(plans): resultado da auditoria de sessions`: preenche o "Resultado" deste plano e a linha do `docs/RETRO.md`.

## Arquivos a tocar
| Arquivo | Mudança |
|---|---|
| `test/sessions-caracterizacao.e2e-spec.ts` | novo (estimativa: 250–300 linhas; teste de caracterização pode passar de 300) |
| `docs/domain.md` | título da seção de sessões e 2 referências a `wip/sessions` |
| `AGENTS.md` | linha de "Cuidados conhecidos" sobre sessions |
| `docs/plans/2026-10-19-auditoria-sessions.md` | este plano + Resultado |
| `docs/RETRO.md` | uma linha |

## Abstrações novas
- Nenhuma. O setup de usuários e fichas é copiado do padrão de `test/routines-caracterizacao.e2e-spec.ts`, sem extrair helper compartilhado (seria o segundo uso, mas a regra pede dois usos **já existentes** antes de abstrair, e extrair mexeria no arquivo de routines).

## Dependências novas
Nenhuma.

## Como verificar
```bash
npm run typecheck
npm test
npm run lint:check

# Postgres descartável em porta livre descoberta na hora (nunca 5433, o de desenvolvimento)
PORT=$(node -e "const s=require('net').createServer();s.listen(0,()=>{console.log(s.address().port);s.close()})")
echo "$PORT"   # conferir que não é 5433 nem 5432
docker run -d --rm --name exactafit-audit-pg -e POSTGRES_PASSWORD=audit -e POSTGRES_DB=audit -p "$PORT":5432 postgres:16-alpine
# esperar o banco aceitar conexão (pg_isready dentro do contêiner) e então:
DATABASE_URL="postgresql://postgres:audit@localhost:$PORT/audit" JWT_SECRET="<32+ caracteres obviamente falsos>" npx prisma migrate deploy
DATABASE_URL="postgresql://postgres:audit@localhost:$PORT/audit" JWT_SECRET="<mesmo valor>" npm run test:e2e
docker stop exactafit-audit-pg   # --rm remove o contêiner; sem volume nomeado

# Nada fora de sessions mudou
git diff --stat main...HEAD
git diff main...HEAD -- src prisma package.json package-lock.json .github .claude   # deve sair vazio
```
`DATABASE_URL` e `JWT_SECRET` vão inline: o `dotenv` não sobrescreve variável já definida, e o `.env` não é lido nem impresso.

## Documentação (definição de pronto)
- [x] Atualiza: `docs/domain.md` (só descrição desatualizada, A8; nenhuma regra muda).
- [ ] ~~Sem impacto em doc~~

## Fora de escopo
- Corrigir qualquer achado (A1–A10). Cada um vira plano próprio depois da aprovação deste.
- Endpoint de sincronismo, migrations de `finishedAt`/`SetLog`/FKs, rotas de série e de atualização.
- Resolver as perguntas abaixo **no código** ou gravá-las em `domain.md`/ADR (isso é `registrar-decisoes`, depois das respostas).
- Mexer nas specs unitárias de sessions ou unificar a interface `AuthenticatedRequest` (duplicada em `routines` e `sessions`).
- Ordem da fila: o STATUS do manual põe a fila 1 (dependências, PR 2) e a fila 2 (OpenAPI) antes desta; executar esta antes é escolha do humano.

## Perguntas para o humano
Nenhuma bloqueia esta tarefa: os testes travam o comportamento atual seja qual for a resposta. Elas definem os planos de correção.

- **P1 — `CONFIRMAR(humano)` (S4, ADR 0004):** como a API sabe se a sessão é "iniciada online" (recusa ficha vazia) ou "do sincronismo" (aceita)? (a) **rotas diferentes**: `POST /sessions` é sempre online e o sincronismo tem endpoint próprio; custo: duas rotas que criam sessão. (b) **rota única** com o `POST /sessions` idempotente servindo aos dois; custo: S4 deixa de ser aplicável, ou exige um marcador no body.
- **P2 — `CONFIRMAR(humano)` (S3):** online, com uma sessão já aberta, um novo início de sessão deve (a) **ser recusado com 409**; custo: o app precisa encerrar a anterior antes; ou (b) **encerrar a anterior automaticamente**, como no sincronismo; custo: encerra um treino esquecido aberto sem perguntar. O ADR 0004 descarta o 409 **só para o sincronismo**; para o online, `domain.md` não diz.
- **P3 — contrato do id (A1):** aprova a abordagem A (id UUID do cliente; reenvio do mesmo usuário → 200 com a sessão gravada; id de outro usuário → 409)? Sub-pergunta: um reenvio com **corpo diferente** para o mesmo id deve devolver o original em silêncio (recomendado: o original vence; a correção é por `PUT`, S9) ou 409? Decisão de contrato externo: vira ADR (ou emenda ao 0004) no plano de A1.
- **P4 — `CONFIRMAR(humano)` (S1):** se o aparelho não enviar `startedAt`, a API (a) usa o `now()` do servidor; custo: um cliente com defeito grava a hora errada sem ninguém notar; ou (b) devolve 400; custo: o campo vira obrigatório no contrato.
- **P5 — execução:** confirma o uso de `npx prisma migrate deploy` e do e2e **só no Postgres descartável** descrito em "Como verificar"?

## Resultado (preencher ao concluir)
- **O que foi feito:** `test/sessions-caracterizacao.e2e-spec.ts` com 14 casos (7 conforme, 7 divergentes), cobrindo toda a tabela "Testes"; o comportamento lido no código se confirmou na execução, sem surpresa. `docs/domain.md` e `AGENTS.md` deixaram de descrever sessions como "só schema"/pendente de auditoria (A8). Nenhum código de produção, schema ou dependência mudou.
- **Desvios do plano:** executado já no kit 1.2, em que esta tarefa é de risco baixo: seguiu direto ao PR, sem aprovação prévia do plano nem `implementador`. `docs/RETRO.md` e o bloco "Para o manual" saíram do kit e não foram preenchidos. Os achados continuam válidos com o escopo novo (`docs/produto.md`): A1, A2, A3, A6 e A7 entram na tarefa 2; A4, A5 e A9 na tarefa 3; as perguntas P1–P4 deste plano são decididas nos critérios de aceite dessas tarefas.
- **Pendências:** correções A1–A9 (tarefas 2, 3 e 17 de `docs/produto.md`).
- **PR/commit:** branch `test/auditoria-sessions`.
- **Docs atualizadas:** `docs/domain.md` (descrição de sessions, sem mudar regra), `AGENTS.md` ("Cuidados conhecidos").
- **Evidência:** Postgres 16 descartável em porta livre (42631), `npx prisma migrate deploy` e `npm run test:e2e`: 88 passaram, 2 `todo` (já existentes em `routines-caracterizacao`), 90 no total. A suíte nova sozinha: 14 de 14.
