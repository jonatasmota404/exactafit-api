# Plano: Dockerfile de produção e execução das migrations do Prisma

> O humano aprova antes de o `implementador` começar. O plano preenchido, com o "Resultado" ao concluir, é o registro da tarefa.

Aprovado por: humano, na mensagem que mandou implementar este plano com a alternativa E1 (2026-10-16), ajustado pelas decisões abaixo.
Modelo recomendado: Sonnet 5.5 (o da sessão) — arquivo novo, pequeno e já prototipado; o peso está na verificação.

## Intenção
Criar a imagem de produção da API (Node 24 alpine, multi-stage, usuário não-root, `HEALTHCHECK` em `GET /`) para deploy em VPS própria com Coolify (build pack Dockerfile, atrás do Traefik do Coolify, Postgres como recurso do Coolify). **Decisão aprovada (alternativa E1 do plano `2026-10-15-migrations-coolify.md`):** o CLI do Prisma fica na imagem de runtime e o start do contêiner executa `prisma migrate deploy && exec node dist/main`; se a migration falhar, o contêiner sai. A versão anterior deste plano (target `migrate` separado, CLI fora do runtime) foi **substituída**; as medições do protótipo abaixo seguem como histórico.

## Diagnóstico (conferido por comando nesta sessão, na `main` `cc7e328`)
Prototipei o Dockerfile **fora do repositório** (diretório de scratchpad, contexto copiado), construí e executei as imagens. Nada foi escrito no repositório além deste plano.

- Não existe `Dockerfile` nem `.dockerignore`. CI usa Node 24 (`.github/workflows/ci.yml`, `node-version: 24`).
- `prisma.config.ts` importa `dotenv/config` e `prisma/config` e lê `DATABASE_URL`; o `schema.prisma` usa `provider = "prisma-client-js"` (client gerado em `node_modules/.prisma/client`). O app usa `@prisma/client` + `@prisma/adapter-pg` (`src/prisma/prisma.service.ts`).
- `bcrypt@6` traz prebuilds `linux-x64` **glibc e musl** (`node_modules/bcrypt/prebuilds/linux-x64/`): alpine funciona.
- `src/main.ts`: `app.listen(process.env.PORT ?? 3000)`, sem host (escuta em todas as interfaces), sem `trust proxy`.
- `src/auth/auth.module.ts:12-14`: `process.env.JWT_SECRET || '<literal no repositório>'` (**U8 não aplicada**; é a fila 3 do `STATUS.md`).

### Protótipo (3 stages: `build`, `runtime-app`, `runtime-cli`; `node:24-alpine`)
| Resultado | Evidência |
|---|---|
| Imagem **runtime** (`npm ci --omit=dev --omit=optional --ignore-scripts` + `.prisma` + `dist`): **428 MB** (base `node:24-alpine` 242 MB; `node_modules` 137 MB) | `docker images` |
| Imagem **com CLI** (`npm ci --omit=dev`, `prisma/`, `prisma.config.ts`): **818 MB** (`node_modules` 411 MB) | `docker images` |
| Runtime **não contém** `prisma`, `mysql2`, `deepmerge-ts`, `fast-uri` (`ls node_modules`); só `@prisma/{adapter-pg,client,client-runtime-utils,debug,driver-adapter-utils}`; roda como `node` | `docker run proto-app sh -c ...` |
| Contra Postgres 16 limpo, a imagem com CLI aplicou as 6 migrations: `All migrations have been successfully applied.` | `npx prisma migrate deploy` |
| Runtime sobe e responde: `GET /` → `200 {"status":"ok"}`; `POST /auth/register` → `201`; `POST /auth/login` → `accessToken` (prova que `bcrypt` musl, o client gerado e o adapter funcionam **sem** o CLI) | `curl` |
| `wget -qO- http://127.0.0.1:3000/` existe na imagem alpine e devolve o JSON (serve para `HEALTHCHECK`; não há `curl`) | `docker exec` |
| `npm audit --omit=dev --omit=optional`: **4** (1 critical, 2 high, 1 moderate) = `@nestjs/platform-express`, `multer`, `proxy-addr`, `qs`, todas corrigidas por `npm audit fix` (plano das dependências, Parte A). **A cadeia do Prisma some.** | `npm audit ... --json` |
| **Runtime sobe sem `JWT_SECRET`** e responde `GET /` 200 (cai no literal do repositório) | `docker run` sem `-e JWT_SECRET` |

## Decisão técnica: onde rodam as migrations
**E1** (aprovada): migration no start do contêiner, sob rolling update do Coolify com `HEALTHCHECK` obrigatório. Comparação das alternativas, premissas da documentação do Coolify e o que só a VPS prova: `docs/plans/2026-10-15-migrations-coolify.md` e `docs/adr/0010-migrations-no-start-do-conteiner.md`. A tabela A/B/C anterior (job de pré-deploy com target `migrate`) foi removida: o pré-deploy do Coolify roda na imagem antiga e é pulado no primeiro deploy.

## Efeito no `npm audit`
- Com E1 a imagem de runtime tem o CLI, então a cadeia do Prisma (`prisma`, `@prisma/config`, `deepmerge-ts`, `mysql2`, `fast-uri`) **volta** ao runtime. Medido nesta tarefa: `npm audit --omit=dev --omit=optional` = 4 (1 critical, 2 high, 1 moderate); `npm audit --omit=dev` = 9 (1 critical, 7 high, 1 moderate). Para a imagem vale o segundo número.
- O PR 2 do plano `2026-10-15-atualizar-dependencias-vulneraveis.md` foi **reaberto** (override de `mysql2` na mesma major; resíduo aceito de `deepmerge-ts` se a 8 quebrar o CLI). Não é implementado nesta tarefa.

## Decisões (padrão; baratas de reverter)
- **Base:** `node:24-alpine` (mesma major do CI; bcrypt tem prebuild musl; já protótipo-validada). Pinagem por digest fica fora (mesma política das actions). SUGESTÃO(IA, não confirmada).
- **Stages:** dois, `build` (npm ci completo, `prisma generate`, `nest build`) → `runtime` (último). O `runtime` faz `npm ci --omit=dev` **com scripts** (o `@prisma/engines` baixa o schema engine), copia `node_modules/.prisma` e `dist`, e leva `prisma/` e `prisma.config.ts`.
- **Geração do client:** só no `build`; o runtime copia `node_modules/.prisma` e `dist`.
- **`CMD`:** `["sh","-c","./node_modules/.bin/prisma migrate deploy && exec node dist/main"]` (binário local, sem `npx`). Migration falhou → exit ≠ 0.
- **Usuário:** `USER node` (uid 1000). Sem diretório gravável.
- **Env:** `NODE_ENV=production`; `PORT` (padrão 3000); `DATABASE_URL` e `JWT_SECRET` **só em runtime**, nunca em `ENV`/`ARG`/`COPY` (sem `.env` na imagem).
- **`HEALTHCHECK` (obrigatório):** `wget -qO- http://127.0.0.1:${PORT:-3000}/ >/dev/null || exit 1`, com `--interval=30s --timeout=5s --start-period=60s --retries=3`. O `start-period` cobre o tempo das migrations antes de a porta abrir. Liveness, igual ao `GET /`; **não** checa banco.
- **Variáveis de runtime:** `DATABASE_URL`, `JWT_SECRET`, `PORT` (padrão 3000), `NODE_ENV=production`. `JWT_SECRET` entra só em runtime; **não** há checagem de boot nesta tarefa. No Coolify, **Ports Exposes = 3000**.
- **Primeiro deploy bloqueado pela fila 3 (U8):** condição explícita — `JWT_SECRET` sem valor padrão mergeado **e** pré-voo `docker run` da imagem sem `JWT_SECRET` encerrando com exit ≠ 0.
- **`.dockerignore`:** `node_modules`, `dist`, `.git`, `.github`, `.claude`, `.agents`, `.windsurf`, `docs`, `test`, `coverage`, `.env*`, `*.md`, `docker-compose.yml`, `Dockerfile`, `.dockerignore`.

## Proxy e `trust proxy`
- O app **não lê `req.ip`** nem `X-Forwarded-*` (`grep` em `src/` vazio) e `trust proxy` é `false` (`express/lib/application.js:99`). Com isso `proxy-addr` não é consultado para confiar em cabeçalhos: o `critical` **não é alcançável** hoje, atrás de proxy ou não.
- **Se o deploy ficar atrás de proxy/PaaS:** nada muda no app **enquanto nada precisar do IP do cliente**. Quando entrar rate limit, log de auditoria ou qualquer leitura de `req.ip`, será preciso `app.set('trust proxy', <n saltos | CIDR do proxy>)` em `src/main.ts` (nunca `true`), e nesse ponto `proxy-addr` precisa estar em `>=2.0.8` (Parte A do plano das dependências). **Fora desta tarefa**; fica registrado como gatilho.
- Decisão: `trust proxy` **continua desligado**; Traefik do Coolify na frente. Gatilho: reconferir `proxy-addr` quando entrar rate limit ou log de IP.
- TLS termina no proxy; o container fala HTTP em `PORT`.

## Critérios de aceite
- [ ] `docker build -t exactafit-api .` produz a imagem de runtime.
- [ ] A imagem **contém** o CLI (`node_modules/.bin/prisma`) e roda como `node`.
- [ ] Contra Postgres vazio, o boot aplica as 6 migrations (`All migrations have been successfully applied.`); novo boot é no-op (`No pending migrations to apply.`).
- [ ] `GET /` → `200 {"status":"ok"}`; `POST /auth/register` → 201 e `POST /auth/login` → `accessToken`.
- [ ] `docker inspect` mostra `Healthcheck` (com `StartPeriod`) e `State.Health.Status` = `healthy`.
- [ ] Migration que falha de propósito (fora do repositório, descartável) → contêiner sai com exit ≠ 0 e **não** ouve a porta.
- [ ] Nenhum `.env` na imagem (`ls -a /app`).
- [ ] Pré-voo do primeiro deploy registrado como **condição**: `docker run` sem `JWT_SECRET` deve encerrar com exit ≠ 0 (hoje **falha**, ver Resultado).
- [ ] `npm audit --omit=dev --omit=optional` e `npm audit --omit=dev` registrados.
- [ ] Nenhum arquivo de `src/`, `prisma/`, `package.json`, `.github/` ou `.claude/` alterado.
- [ ] Typecheck, testes unitários, e2e, lint e build passam.

## Testes (escritos antes do código)
Sem teste novo de unidade: configuração de infraestrutura, sem mudança de comportamento de código. O critério de aceite é **teste de fumaça da imagem**, executado e colado no "Resultado" (comandos em "Como verificar"). Risco médio: peço ao humano que aprove esta lista de verificações junto com o plano.

| Critério | Caso (entrada → esperado) | Onde |
|---|---|---|
| Build | `docker build` → exit 0 | manual (comandos abaixo) |
| Migrations no boot | Postgres vazio → "successfully applied"; 2º boot → "No pending" | idem |
| Boot e rota pública | `GET /` → 200 `{"status":"ok"}` | idem |
| bcrypt/JWT na imagem | register 201 + login com `accessToken` | idem |
| Health check | `healthy` | idem |
| Falha de migration | migration `SELECT 1/0` → exit 1, porta fechada | idem |
| Pré-voo `JWT_SECRET` | sem a variável → exit ≠ 0 (condição para o 1º deploy) | idem |

## Risco
- **Nível:** médio.
- **Toca zona de risco?** Arquivos novos fora da lista do `AGENTS.md` (`Dockerfile`, `.dockerignore`, ADR). **Não** toca `src/auth/`, `prisma/`, `package.json`, `.github/workflows/`, `.claude/`. **Indireto:** a imagem **depende** de `JWT_SECRET`, e o app hoje sobe sem ele (U8, fila 3).
- **O que pode quebrar:** (i) `--omit=optional` omitir uma dependência opcional que o app passe a precisar → o fumaça de boot pega; (ii) alpine/musl com dependência nativa futura sem prebuild; (iii) migration incompatível com a versão anterior durante o rolling update (regra expand/contract do ADR 0010); (iv) migration que falha no meio deixa o banco parcial e bloqueia deploys por `P3009`.

## Menor esforço
Menor esforço: considerei pré-deploy do Coolify, Compose com serviço `migrate`, segunda aplicação, migrations pelo CI e `distroless`; escolhi uma imagem única que migra no start (E1), sem orquestração nem dependência nova, porque é a única alternativa com todas as premissas documentadas.

## Segurança (risco médio; segredos e dependências)
- **Segredos:** nenhum segredo em imagem, `ARG` ou histórico de camadas; `.env*` no `.dockerignore`. **Pendência bloqueante do deploy, não da imagem:** `JWT_SECRET` sem valor padrão (fila 3; **verificado** que o container hoje sobe sem ele e assina com o literal público). Opções na Pergunta 2.
- **Superfície:** usuário não-root; o CLI e a cadeia dele **estão** no runtime (E1); `HEALTHCHECK` sem expor nada além de `{ status }`; só `EXPOSE 3000`. A migration roda com a credencial da aplicação (DDL em runtime); usuário separado fora de escopo.
- **Dependências:** nenhuma nova. Imagem base `node:24-alpine` oficial; os dois `npm audit` ficam registrados no Resultado.
- **Cadeia de suprimento:** `npm ci` (lockfile). O runtime **executa** scripts de instalação (o `@prisma/engines` baixa o schema engine); aceito, pois o CLI precisa dele.
- **Não se aplica agora:** TLS (termina no proxy), assinatura de imagem/SBOM (fora de escopo).

## Tarefas (um commit cada, branch `chore/dockerfile-coolify`, nascida da `main`)
1. `docs(plans): planos de deploy no Coolify` — os três planos, como aprovados (inclui o plano das dependências com o PR 2 reaberto).
2. `feat(docker): Dockerfile com migrations no start e .dockerignore` — `Dockerfile` + `.dockerignore`.
3. `docs(adr): migrations rodam no start do contêiner (Coolify)` — ADR 0010.
4. `docs(plans): resultado do deploy no Coolify` — "Resultado" dos três planos + `docs/RETRO.md`.

Estimativa de diff de produção: ~30 linhas (`Dockerfile` 25, `.dockerignore` 15).

## Arquivos a tocar
| Arquivo | Mudança |
|---|---|
| `Dockerfile` | novo (stages `build` e `runtime`) |
| `.dockerignore` | novo |
| `docs/adr/0010-migrations-no-start-do-conteiner.md` | novo |
| `docs/plans/2026-10-15-dockerfile-producao.md` | alinhado à E1; "Resultado" |
| `docs/RETRO.md` | linha da tarefa |

## Abstrações novas
- Nenhuma.

## Dependências novas
Nenhuma. (Imagem base `node:24-alpine` já usada localmente; sem pacote npm novo.)

## Como verificar
```bash
npm run typecheck && npm test && npm run lint:check && npm run build   # inalterados
docker build -t exactafit-api:fumaca .
docker images exactafit-api                                            # tamanho (medido: 818 MB)

# rede e Postgres descartáveis
docker network create fumaca-net
docker run -d --name pg-fumaca --network fumaca-net -e POSTGRES_PASSWORD=x -e POSTGRES_DB=app postgres:16-alpine
URL="postgresql://postgres:x@pg-fumaca:5432/app?schema=public"
docker run -d --name api-fumaca --network fumaca-net -e DATABASE_URL="$URL" -e JWT_SECRET=teste-local -p 3055:3000 exactafit-api:fumaca
docker logs api-fumaca                                                 # 6 migrations aplicadas
curl -i localhost:3055/                                                # 200 {"status":"ok"}
curl -s -H 'content-type: application/json' -d '{"name":"T","email":"t@t.com","password":"senha12345"}' localhost:3055/auth/register
curl -s -H 'content-type: application/json' -d '{"email":"t@t.com","password":"senha12345"}' localhost:3055/auth/login
docker inspect -f '{{.State.Health.Status}}' api-fumaca                # healthy
# pré-voo (condição do 1º deploy): sem JWT_SECRET deve sair com exit != 0
docker run -d --name api-nojwt --network fumaca-net -e DATABASE_URL="$URL" exactafit-api:fumaca
# falha de migration: copiar para o contêiner (docker create + docker cp) uma migration com `SELECT 1/0;` fora do repositório
npm audit --omit=dev --omit=optional
npm audit --omit=dev
```

## Documentação (definição de pronto)
- [x] Atualiza: ADR `docs/adr/0010-migrations-no-start-do-conteiner.md` (decisão de implantação, difícil de mudar depois que a plataforma e o pipeline dependerem dela).
- [ ] Sem impacto em doc: <!-- não vale: há ADR -->

## Fora de escopo
- Configurar a VPS, o Coolify, Traefik, domínio, backup agendado e restauração (ação do humano).
- Job de build da imagem no CI (`.github/workflows/`, zona de risco; tarefa própria).
- `docker-compose` de produção; alterar o `docker-compose.yml` de desenvolvimento.
- Remover o valor padrão do `JWT_SECRET` (`src/auth/`, fila 3), `trust proxy`, `npm audit fix` e overrides (plano das dependências).
- Pinagem da imagem por digest, assinatura/SBOM, scan de imagem.
- Seed/carga do dataset de exercícios (ADR 0005).

## Decisões do humano (substituem as perguntas anteriores)
1. Deploy em VPS própria com Coolify, build pack Dockerfile, atrás do Traefik; Postgres como recurso do Coolify na mesma rede. Alternativa **E1**.
2. `JWT_SECRET` entra como variável de runtime; primeiro deploy bloqueado pela fila 3 (U8), com pré-voo registrado como condição explícita; sem checagem de boot nesta tarefa.
3. `trust proxy` desligado; gatilho: reconferir `proxy-addr` com rate limit ou log de IP.
4. `HEALTHCHECK` no Dockerfile é obrigatório (`wget` em `GET /`, `--start-period` cobrindo as migrations).
5. Plano das dependências: PR 2 reaberto (override de `mysql2`; resíduo aceito de `deepmerge-ts` se a 8 quebrar o CLI). Só o plano é atualizado agora.

## Resultado
- **O que foi feito:** `Dockerfile` (2 stages, `node:24-alpine`, `USER node`, Prisma Client gerado no `build`, CLI no runtime, `HEALTHCHECK` com `--start-period=60s`, `CMD` com `migrate deploy && exec node dist/main`), `.dockerignore` e o ADR 0010. Plano alinhado à E1.
- **Medições (host Linux, Docker 29.1.3, build em 5 min 52 s com a máquina sob carga):**

| Verificação | Resultado |
|---|---|
| Tamanho da imagem | **818 MB** em disco (`docker images`; conteúdo comprimido 181 MB) |
| Boot em banco vazio | `6 migrations found` → `All migrations have been successfully applied.`; `_prisma_migrations` com 6 linhas concluídas |
| `GET /` | `200 {"status":"ok"}` |
| `POST /auth/register` / `POST /auth/login` | `201` com o usuário / `accessToken` (bcrypt, client gerado e adapter funcionam na imagem) |
| Usuário e conteúdo | `id -un` = `node`; `/app` = `dist`, `node_modules`, `package*.json`, `prisma`, `prisma.config.ts` (sem `.env`) |
| Health check | `Healthcheck` com `Interval 30s`, `Timeout 5s`, `StartPeriod 60s`, `Retries 3`; `State.Health.Status` = `healthy` |
| 2º boot | `No pending migrations to apply.` |
| **Migration quebrada** (`CREATE TABLE meia_migration; SELECT 1/0;`, copiada com `docker cp` para um contêiner descartável, fora do repositório) | `P3018 ... division by zero`; contêiner `exited`, **exit 1**; `GET /` sem resposta (porta fechada). Banco: tabela parcial `meia_migration` **permaneceu** e a migration ficou com `finished_at` nulo (confirma o plano: não é atômica, exige intervenção manual / P3009) |
| `npm audit --omit=dev --omit=optional` | 4 (1 critical, 2 high, 1 moderate) |
| `npm audit --omit=dev` | **9** (1 critical, 7 high, 1 moderate) |
| typecheck, `npm test`, `lint:check`, `build` | passam (unitários: 3 suítes, 3 testes) |
| `npm run test:e2e` (Postgres descartável na porta 5434, com `migrate deploy`) | 6 suítes passam; 74 passam, 3 `todo` (já existentes) |
| Diff de `src/`, `test/`, `prisma/`, `.github/`, `package*.json` | vazio |

- **Pré-voo do primeiro deploy: FALHA hoje.** `docker run` sem `JWT_SECRET` (banco já migrado) → contêiner `running`, exit 0, e responde (usa o literal do repositório). É o esperado até a fila 3 (U8): **o primeiro deploy continua bloqueado**; a condição está no ADR 0010 e neste plano.
- **Achado novo (não previsto no plano): `SIGTERM`.** Com `exec node dist/main` o Node é PID 1 e, sem handler, ignora `SIGTERM`. `docker stop` terminou com **exit 137** (`SIGKILL` após o prazo); com `docker run --init` terminou com **exit 143** (`SIGTERM`). A premissa do plano ("`exec` para o Node receber `SIGTERM`") só vale com init ou handler. As durações medidas (27–42 s) estão infladas pela carga da máquina (load ~28), então **só os códigos de saída são evidência**. Em rolling update isso corta requisições em andamento. **Não corrigi** (escopo; `tini` seria pacote novo e `enableShutdownHooks` mexeria em `src/`): decisão do humano.
- **Desvios do plano:** (1) uma só branch (`chore/dockerfile-coolify`) para os dois planos e o ADR; (2) e2e rodou contra Postgres **descartável** (porta 5434), não o `treino_postgres` do `docker-compose` (os e2e fazem `deleteMany` e o banco local tem dados do humano); (3) o hook de guardrail bloqueou duas vezes o meu script de teste (remoção recursiva forçada e remoção de banco); reescrevi sem esses comandos (banco novo em vez de recriar) e não contornei o hook.
- **Não verificado (só na VPS):** comportamento do Coolify (rolling update mantém o contêiner antigo se o novo não ficar `healthy`; `HEALTHCHECK` da imagem com precedência; env só de runtime; Internal URL do Postgres; versão ≥ `4.0.0-beta.471`); lock do Prisma com dois `migrate deploy` simultâneos; backup agendado e restauração. Passo a passo no plano `2026-10-15-migrations-coolify.md`.
- **Pendências:** (a) fila 3 (U8) antes do primeiro deploy; (b) decidir o `SIGTERM` (init no Coolify, `tini` ou `enableShutdownHooks`); (c) PR 2 das dependências (plano atualizado, não implementado); (d) executar a verificação na VPS.
- **PR/commit:** branch `chore/dockerfile-coolify`, com push; **PR não aberto** (merge e PR são do humano).
- **Docs atualizadas:** `docs/adr/0010-migrations-no-start-do-conteiner.md`; planos de migrations, Dockerfile e dependências; `docs/RETRO.md`.

### Para o manual
- **O que mudou no comportamento:** existe imagem de produção; ao subir, o contêiner aplica as migrations antes de abrir a porta e sai (exit ≠ 0) se falharem.
- **Decisões novas em domain/ADR:** ADR 0010 (E1; regra expand/contract; backup antes de deploy com migration; procedimento P3009; `trust proxy` desligado com gatilho). `domain.md` não muda.
- **O que o humano precisa entender:** primeiro deploy bloqueado até a fila 3; achado do `SIGTERM` aguardando decisão; premissas do Coolify seguem "não verificado" até o teste na VPS; imagem de 818 MB e `npm audit --omit=dev` = 9 até o PR 2.
