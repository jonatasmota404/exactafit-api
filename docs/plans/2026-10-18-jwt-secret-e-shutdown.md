# Plano: `JWT_SECRET` obrigatório (U8, fila 3); encerramento limpo adiado

> O humano aprova antes de o `implementador` começar. O plano preenchido, com o "Resultado" ao concluir, é o registro da tarefa.

Aprovado por: humano em 2026-10-18, **só a parte do `JWT_SECRET`** (mínimo de 32 caracteres via `registerAsync`, remoção do literal, remoção do `test.todo` do fallback). O encerramento limpo (`SIGTERM`) foi **adiado** (seção "Adiado").
Modelo recomendado: Opus 5.5 (o da sessão) — toca `src/auth/` (zona de risco); não pede troca de modelo.

## Intenção
A API deixa de subir sem `JWT_SECRET` ou com segredo de menos de 32 caracteres (antes caía num literal público do repositório e respondia 200), destravando o pré-voo do primeiro deploy (ADR 0010).

## Diagnóstico (conferido por comando, na `main` `57c16d9`)
Onde o segredo é lido (`grep -rn "JWT_SECRET\|secret"` em `src test .github docs Dockerfile`):
- `src/auth/auth.module.ts:10-16`: `JwtModule.register({ global: true, secret: process.env.JWT_SECRET || '<literal>', signOptions: { expiresIn: '7d' } })`. **Única ocorrência do literal** no código versionado (`dist/` é artefato de build). Avaliado no `import` do módulo, depois de `import 'dotenv/config'` (linha 5).
- `src/auth/auth.guard.ts:30-32`: `verifyAsync(token, { secret: process.env.JWT_SECRET })`. Sem a variável, passava `undefined` e o `@nestjs/jwt` usava o segredo do módulo (o literal).
- `src/auth/auth.service.ts:59`: `signAsync(payload)` usa o segredo do módulo.
- Não há "estratégia" (Passport): só `AuthGuard` + `JwtService`.
- Testes: unitários não usavam o segredo. E2e: `test/authguard-caracterizacao.e2e-spec.ts:105` assina com segredo aleatório (`outro-<uuid>`, espera 401; não muda); `:177-179` tinha `test.todo` com a hipótese do fallback (U8). Os e2e recebem o segredo do ambiente: CI em `.github/workflows/ci.yml:62,68` (`ci-only-fake-jwt-secret-not-a-real-secret`, 41 caracteres); local pelo `.env` via `dotenv/config` (**não verificado**: o `.env` não é lido por regra).
- `jsonwebtoken@9.0.3` não confere tamanho de chave HMAC (`sign.js:132` só vale para RSA/PS).

## Decisões
- **Como falhar no boot (aprovado):** `JwtModule.registerAsync({ global: true, useFactory })`. A fábrica lê `process.env.JWT_SECRET` e lança `Error` se faltar ou tiver menos de 32 caracteres; senão devolve `{ secret, signOptions: { expiresIn: '7d' } }`. Roda na criação do módulo (`NestFactory.create`/`compile()`), não no `import`: testável sem Postgres. Sem `@nestjs/config`. `import 'dotenv/config'` continua.
- **Mensagem:** `JWT_SECRET ausente ou com menos de 32 caracteres`, fixa, sem o valor nem o tamanho recebido.
- **Tamanho mínimo: 32 caracteres (aprovado).** Base: RFC 7518 §3.2 (HS256 exige chave de pelo menos 256 bits).
- **Exit no contêiner:** a rejeição de `bootstrap()` vira exceção não tratada e o Node sai com 1. Como `migrate deploy` roda antes (`&&`), o pré-voo precisa de `DATABASE_URL` válido; o exit ≠ 0 vem do Node.
- **`AuthGuard` e fluxo de register/login não mudam (aprovado).**
- **Tokens já emitidos:** nenhum; a API não está em produção (`domain.md`, U8). Efeito só em desenvolvimento local: tokens assinados com o literal deixam de valer.

## Critérios de aceite
- [x] Sem `JWT_SECRET`, a criação do app falha com erro cuja mensagem cita `JWT_SECRET`.
- [x] Com `JWT_SECRET` de menos de 32 caracteres, idem, sem o valor na mensagem.
- [x] Com `JWT_SECRET` válido, o app sobe; `POST /auth/register` → 201, `POST /auth/login` → 201 com `accessToken`, rota protegida aceita o token (e2e existentes, sem alteração de asserção).
- [x] O literal não existe mais no código: `git grep -n "oDVCX" -- src test` vazio.
- [x] **Pré-voo (ADR 0010):** `docker run` da imagem com `DATABASE_URL` válido e **sem** `JWT_SECRET` termina com exit ≠ 0.
- [x] Typecheck, testes unitários, lint, build e e2e passam.

## Testes (escritos antes do código)
| Critério | Caso (entrada → esperado) | Arquivo de teste |
|---|---|---|
| Falha sem segredo | `delete process.env.JWT_SECRET`; `compile()` de `[PrismaModule, AuthModule]` com `PrismaService` sobrescrito → rejeita com `/JWT_SECRET/` | `src/auth/auth.module.spec.ts` (novo) |
| Falha com segredo curto | segredo de teste de 31 caracteres → rejeita com `/JWT_SECRET/`, mensagem não contém o valor | idem |
| Boot com segredo | segredo de teste de 33 caracteres → `compile()` resolve; `signAsync` + `verifyAsync` fazem ida e volta | idem |
| Register/login seguem iguais | e2e existentes (`auth.e2e-spec.ts`, `authguard-caracterizacao.e2e-spec.ts`) **sem alteração de asserção**, com segredo de teste de 32+ do ambiente | — |
| Pré-voo | manual: `docker run` sem `JWT_SECRET` → exit ≠ 0 (Resultado) | — |

- O spec restaura `process.env.JWT_SECRET` no `afterEach`; o `.env` local não interfere porque o valor é apagado/sobrescrito antes do `compile()`.
- **Teste alterado:** `test/authguard-caracterizacao.e2e-spec.ts` — removido o `test.todo` da hipótese do fallback (app rodando sem `JWT_SECRET`): o cenário deixou de ser possível e passou a ser coberto por `src/auth/auth.module.spec.ts`. Aprovado pelo humano. Nenhuma outra verificação existente mudou.

## Risco
- **Nível:** médio.
- **Toca zona de risco?** Sim: `src/auth/auth.module.ts`. Não toca `prisma/`, `package.json`, `.github/workflows/`, `.claude/`, `Dockerfile`.
- **O que pode quebrar:** ambiente sem a variável ou com segredo < 32 deixa de subir: `.env` local do humano (**não verificado**) e scripts de smoke antigos com `JWT_SECRET=teste-local` (só texto em planos anteriores). O CI já tem 41 caracteres.

## Menor esforço
Menor esforço: considerei `@nestjs/config` + schema (dependência nova, um uso) e checagem no topo do arquivo (lança no `import`, não testável sem isolar módulo); escolhi `registerAsync` com fábrica que valida, porque usa só o que já está instalado, muda um arquivo de produção e é testável sem banco.

## Segurança
- **Segredos (aplica):** sem fallback; segredo só por variável de runtime (ADR 0010); mensagem de erro sem valor. Verificação: teste unitário (mensagem não contém o valor), log do contêiner sem o valor, `git grep` do literal vazio. O literal segue no histórico público do git: **nunca** deve ser usado como segredo real.
- **Força do segredo (aplica):** mínimo de 32 caracteres; não mede entropia. Gerar com `openssl rand -base64 32` (44 caracteres) e guardar no gerenciador de senhas (U8).
- **Autenticação (aplica):** algoritmo e expiração inalterados (`HS256` padrão, `7d`); register/login provados pelos e2e existentes e pela imagem.
- **Não se aplica agora:** dependências (nenhuma nova); entrada externa e dados pessoais (nenhuma rota muda); rotação de segredo (não há produção nem tokens; gatilho: primeira troca de segredo em produção desloga todos).

## Tarefas (um commit cada)
1. `fix(auth): JWT_SECRET obrigatório no boot, mínimo de 32 caracteres (U8)` — spec novo primeiro (falha antes do código), `registerAsync` com validação, remoção do `test.todo` (declarado), `docs/domain.md` (U8), ADR 0010 (pré-voo), este plano, o plano de dependências (linha do PR) e `docs/RETRO.md`.

## Arquivos a tocar
| Arquivo | Mudança |
|---|---|
| `src/auth/auth.module.ts` | `register` → `registerAsync` com fábrica que valida; remove o literal |
| `src/auth/auth.module.spec.ts` | novo: 3 casos (sem, curto, válido) |
| `test/authguard-caracterizacao.e2e-spec.ts` | remove o `test.todo` da hipótese do fallback (Teste alterado) |
| `docs/domain.md` | U8 (regra e linha de "Mudanças de código decorrentes") |
| `docs/adr/0010-migrations-no-start-do-conteiner.md` | só o item do pré-voo do `JWT_SECRET` |
| `docs/plans/2026-10-18-jwt-secret-e-shutdown.md` | escopo, "Adiado" e Resultado |
| `docs/plans/2026-10-15-atualizar-dependencias-vulneraveis.md` | "PR não aberto" → "PR #30, mergeado em 2026-10-18" |
| `docs/RETRO.md` | uma linha |

## Abstrações novas
- Nenhuma.

## Dependências novas
Nenhuma.

## Como verificar
```bash
npm run typecheck
npm test
npm run lint:check
npm run build
git grep -n "oDVCX" -- src test          # vazio
# e2e em Postgres descartável (nunca o banco de desenvolvimento), com segredo de teste de 32+:
npx prisma migrate deploy && npm run test:e2e
```
Manual (imagem local, Postgres descartável numa rede própria):
```bash
docker build -t exactafit-api:u8 .
docker run --network <rede> -e DATABASE_URL="$URL_PRE" exactafit-api:u8; echo "exit=$?"     # != 0
docker run -d -p 3077:3000 --network <rede> -e DATABASE_URL="$URL_VAZIO" -e JWT_SECRET="$(openssl rand -base64 32)" exactafit-api:u8
# 6 migrations no log; GET / 200; register 201; login 201; rota protegida 200 com token e 401 sem
```

## Documentação (definição de pronto)
- [x] Atualiza: `docs/domain.md` (U8) e ADR `docs/adr/0010-migrations-no-start-do-conteiner.md` (pré-voo).
- [ ] Sem impacto em doc: —

## Fora de escopo
- Tudo da seção "Adiado" (`enableShutdownHooks`, `$disconnect`, `tini`, `--init`).
- Qualquer mudança no `Dockerfile`, no `.github/workflows/` ou checagem de boot no `CMD`.
- Remover o `secret:` redundante do `AuthGuard` (limpeza).
- `@nestjs/config`, validação de outras variáveis (`DATABASE_URL`, `PORT`).
- Rotação de segredo, `trust proxy`, rate limit (caso 6), auditoria do módulo sessions.
- O deploy em si e a verificação na VPS (plano `2026-10-15-migrations-coolify.md`).
- Escrever no manual.

## Adiado: encerramento limpo (`SIGTERM`)
**Decisão do humano (2026-10-18):** não implementar agora. Motivo: o cliente é offline first e reenvia requisições, e o Coolify sobe o contêiner novo antes de parar o antigo (**não verificado** na VPS). **Gatilho de revisão:** trabalho em segundo plano na API ou clientes que não reenviem. **Efeito conhecido e aceito:** sem tratamento de `SIGTERM`, o contêiner sai com exit 137 após cerca de 10 s (`docker stop`), cortando requisições em andamento.

Análise feita (lida em `node_modules`, Nest `11.2.7`, Node `v24.17.0`; nada executado), para quando o gatilho disparar:
- `src/main.ts` não chama `enableShutdownHooks()`; `PrismaService` só tem `onModuleInit` (`$connect`), **nenhum** `$disconnect`.
- `enableShutdownHooks()` registra `process.on('SIGTERM'|...)`. Com handler, o kernel **entrega** o `SIGTERM` ao Node mesmo como PID 1. Ordem no handler (`nest-application-context.js:192-219`): `onModuleDestroy` → `beforeApplicationShutdown` → `dispose()` (fecha o HTTP: `server.close`, que espera as requisições em andamento) → `onApplicationShutdown` → **`process.kill(process.pid, signal)`**.
- **Achado:** esse último passo reenvia o sinal a si mesmo depois de remover os handlers; como PID 1 sem handler, é **ignorado**, e o processo só sai se o event loop esvaziar. O pool do `pg` mantém sockets → risco de voltar ao 137. Hipótese, **não verificada**.
- **Saída:** `enableShutdownHooks([], { useProcessExit: true })` (Nest 11.2.7, linhas 206-210) troca o `process.kill` por `process.exit(0)`. Resolve o PID 1 sem `tini`.
- `enableShutdownHooks()` **não** fecha o Prisma sozinho: o `PrismaService` precisa de `OnApplicationShutdown` com `$disconnect()` (roda **depois** de fechar o HTTP), não `OnModuleDestroy` (roda **antes**: requisição em andamento perderia o banco).
- Riscos registrados: `$disconnect` duplo nos e2e (chamam `prisma.$disconnect()` e depois `app.close()`), esperado no-op; `SIGTERM` durante `prisma migrate deploy` continua ignorado (o `sh` é PID 1 nessa fase).
- Prova planejada: `docker stop` no contêiner saudável → exit 0 (hoje 137), log de encerramento, sem `unexpected EOF` no Postgres. Plano B se continuar 137: `--init` no Coolify (verificar se o painel expõe) ou `tini` via `apk add` (pacote novo, exige aprovação).
- Testes: prova manual com `docker stop` (recomendada) ou e2e com processo filho (exige build no CI, toca `.github/workflows/`, não reproduz o PID 1).

## Perguntas para o humano
1. Seu `.env` local já tem `JWT_SECRET` com 32+ caracteres? Não li o arquivo (regra); se não tiver, `npm run start:dev` e os e2e locais param até você ajustar.
2. Confirma que o literal antigo nunca foi usado como segredo fora do desenvolvimento local? Ele segue no histórico público do git.

## Resultado (2026-10-18)
- **O que foi feito:** branch `fix/jwt-secret-obrigatorio` (da `main` `57c16d9`). `src/auth/auth.module.ts`: `JwtModule.registerAsync` com fábrica que lança `JWT_SECRET ausente ou com menos de 32 caracteres`; literal removido. Spec novo `src/auth/auth.module.spec.ts` (3 casos). `test.todo` do fallback removido (Teste alterado, declarado acima).
- **Teste primeiro:** antes do código, `npx jest src/auth/auth.module.spec.ts` → 2 falhas pelo motivo certo ("Received promise resolved instead of rejected": o módulo subia com o literal) e 1 passou (boot com segredo válido).
- **Verificação (tudo passou):**

| Verificação | Saída |
|---|---|
| `npm run typecheck` | sem erros |
| `npm test` | `Test Suites: 4 passed`, `Tests: 6 passed` |
| `npm run lint:check` | sem erros |
| `npm run build` | sem erros |
| `git grep -n "oDVCX" -- src test` | vazio (exit 1) |
| `npm run test:e2e` (Postgres descartável `postgres:16-alpine` na porta 5434, `migrate deploy` antes, segredo de teste de 43 caracteres) | `Test Suites: 6 passed`; `Tests: 2 todo, 74 passed` (antes: 74 passed + 3 todo; o `todo` a menos é o removido) |
| Imagem, **sem `JWT_SECRET`** (banco vazio, rede própria) | `All migrations have been successfully applied.` → `ERROR [ExceptionHandler] Error: JWT_SECRET ausente ou com menos de 32 caracteres`; contêiner `exited`, **exit 1**. **Pré-voo do ADR 0010 passa.** |
| Imagem, `JWT_SECRET` de 14 caracteres | mesma mensagem, **exit 1**; o valor aparece 0 vezes no log |
| Imagem, segredo válido (`openssl rand -base64 32`), banco vazio | `6 migrations found` → `All migrations have been successfully applied.` → `Nest application successfully started`; `_prisma_migrations` com 6 concluídas; `GET /` → `200 {"status":"ok"}`; `POST /auth/register` → 201; `POST /auth/login` → 201 com `accessToken`; `GET /routine` com token → 200, sem token → 401 |

- **Desvios do plano:** escopo reduzido pelo humano (shutdown adiado; análise movida para "Adiado"). Implementado direto na sessão principal, sem os subagentes `implementador` e `revisor`, seguindo os passos dados pelo humano.
- **Pendências:** merge do PR (humano); responder as perguntas 1 e 2; revisão pelo `revisor` se o humano quiser antes do merge. O primeiro deploy segue bloqueado até o merge (ADR 0010).
- **Não verificado:** `.env` local do humano; comportamento no Coolify (rolling update, env só de runtime); o CI do PR (roda após o push/PR).
- **Limpeza:** contêineres, rede, Postgres descartável e imagem de teste removidos (inclusive a imagem intermediária do build); `proto-app` e `proto-cli` intactas.
- **PR/commit:** branch `fix/jwt-secret-obrigatorio`, com push; PR não aberto (abrir e mergear é do humano).
- **Docs atualizadas:** `docs/domain.md` (U8), `docs/adr/0010-migrations-no-start-do-conteiner.md` (pré-voo), este plano, `docs/plans/2026-10-15-atualizar-dependencias-vulneraveis.md` (PR #30), `docs/RETRO.md`.

### Para o manual
- **O que mudou no comportamento:** a API não sobe sem `JWT_SECRET` ou com menos de 32 caracteres (exit 1, mensagem sem o valor). Ambientes locais e scripts precisam de segredo de 32+ (gerar com `openssl rand -base64 32`).
- **Decisões novas em domain/ADR:** U8 implementada e `CONFIRMADO`, com mínimo de 32 caracteres; ADR 0010: pré-voo do `JWT_SECRET` passa (deploy liberado nesse item após o merge).
- **O que o humano precisa entender:** **encerramento limpo (`SIGTERM`) adiado**: o contêiner continua saindo com exit 137 após ~10 s no `docker stop`, cortando requisições em andamento; aceito porque o cliente é offline first e reenvia, e o Coolify sobe o novo antes de parar o antigo (não verificado na VPS). **Gatilho de revisão:** trabalho em segundo plano na API ou clientes que não reenviem. A solução analisada (`enableShutdownHooks` com `useProcessExit` + `$disconnect` em `OnApplicationShutdown`) está na seção "Adiado" do plano.
