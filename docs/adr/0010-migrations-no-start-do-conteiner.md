# ADR 0010 — Migrations rodam no start do contêiner, sob rolling update do Coolify

- **Status:** aceito
- **Data:** 2026-10-16
- **Autor:** Jônatas Júnior

## Contexto
O deploy será em VPS própria com Coolify (build pack Dockerfile), atrás do Traefik do Coolify, com o Postgres como recurso do Coolify na mesma rede. Era preciso decidir onde `prisma migrate deploy` roda. A documentação do Coolify (consulta de 2026-10-15; detalhes em `docs/plans/2026-10-15-migrations-coolify.md`) mostra que o pré-deploy roda no contêiner **antigo** e é pulado no primeiro deploy, e não documenta seleção de target nem `depends_on: service_completed_successfully` em Compose. O que está documentado é o rolling update: o contêiner novo só substitui o atual se ficar saudável, e o `HEALTHCHECK` da imagem tem precedência.

## Decisão
- A imagem de runtime **contém o CLI do Prisma** e o `CMD` executa `prisma migrate deploy && exec node dist/main`. Se a migration falhar, o contêiner sai com exit ≠ 0, não abre a porta e o Coolify mantém o contêiner atual.
- O `HEALTHCHECK` (`wget` em `GET /`) é **obrigatório** no `Dockerfile`, com `--start-period` que cobre o tempo das migrations. Sem ele, o Coolify trata "iniciado" como pronto.
- `DATABASE_URL`, `JWT_SECRET`, `PORT` e `NODE_ENV` entram **só em runtime**; nunca `ARG`, `ENV` ou `COPY` na imagem.
- **Regra de migration (expand/contract):** toda migration deve ser compatível com a versão anterior da aplicação, porque durante o rolling update a versão antiga continua rodando contra o schema já migrado. Adicionar antes de remover; nunca renomear ou remover, na mesma versão, coluna ou tabela que a versão anterior usa.
- **Backup:** antes de qualquer deploy que traga migration, disparar o backup do Postgres (backup agendado do Coolify). Agendamento e restauração: não verificado.
- **Migration que falha no meio (P3009):** o Prisma não a desfaz (verificado: a tabela criada antes do erro permaneceu e a migration ficou com `finished_at` nulo); enquanto isso, todo novo deploy falha com `P3009`. Procedimento manual, no Terminal do Coolify:
  1. Confirmar que o contêiner anterior segue servindo e fazer backup.
  2. Desfazer à mão o que a migration aplicou antes de falhar (no contêiner do Postgres).
  3. `./node_modules/.bin/prisma migrate resolve --rolled-back <nome_da_migration>`.
  4. Corrigir a migration **em uma migration nova** (nunca editar a existente, regra do `AGENTS.md`) e fazer novo deploy.
- **Primeiro deploy bloqueado.** `JWT_SECRET` ainda tem valor padrão público em `src/auth/auth.module.ts` (fila 3, U8). O primeiro deploy só é liberado quando a fila 3 estiver mergeada e o pré-voo passar: `docker run` da imagem **sem** `JWT_SECRET` deve encerrar com exit ≠ 0. Em 2026-10-16 o pré-voo **falha** (o contêiner sobe e responde `GET /`). Esta decisão não adiciona checagem de boot.
- `trust proxy` continua desligado. Gatilho: ao entrar rate limit, log de IP ou qualquer leitura de `req.ip`, reconferir `proxy-addr` (≥ 2.0.8) e configurar `trust proxy` com o número de saltos ou o CIDR do proxy, nunca `true`.

## Alternativas descartadas
- **Pré-deploy do Coolify:** roda na imagem antiga, aplicaria as migrations antigas e é pulado no primeiro deploy.
- **Compose com serviço `migrate` (`depends_on: service_completed_successfully`, `build.target`):** mantém a imagem sem CLI, mas depende de comportamento que a documentação não confirma e perde o rolling update. Só volta se um teste na VPS provar que o Coolify preserva essas chaves.
- **Segunda aplicação com `Dockerfile.migrate`:** a ordem entre migration e API não é garantida; a API nova poderia subir sem a migration.
- **Migrations pelo CI:** exige expor o banco (porta pública, túnel ou runner na VPS), ampliando a superfície.
- **Pós-deploy:** o deploy já está concluído quando ele roda; a API sobe antes da migration e a falha não derruba o deploy.

## Consequências
- **Positivas:** migration automática; falha segura (nada novo recebe tráfego); zero orquestração; todas as premissas vêm da documentação do rolling update.
- **Negativas / custos:**
  - Imagem de 818 MB (medida), com o CLI e a cadeia de dependências dele (`prisma`, `@prisma/config`, `deepmerge-ts`, `mysql2`, `fast-uri`) no runtime; `npm audit --omit=dev` = 9 (1 critical, 7 high, 1 moderate).
  - A migration roda com a mesma credencial da aplicação, ou seja, com privilégio de DDL em runtime. Gatilho: usuário de migration separado antes de haver dados reais.
  - Migration que falha no meio exige intervenção manual.
  - **Sinais:** com `exec node`, o Node é PID 1 e ignora `SIGTERM` (sem handler no Nest): `docker stop` espera o prazo e termina com `SIGKILL` (exit 137). Com `--init`, o contêiner termina por `SIGTERM` (exit 143). Em rolling update isso corta requisições em andamento. Correção pendente (decisão do humano): init do Docker/Coolify, `tini` na imagem ou `app.enableShutdownHooks()`.
- **O que passa a ser obrigatório:**
  - Toda migration nova é compatível com a versão anterior (expand/contract).
  - Backup do Postgres antes de deploy com migration.
  - Nenhum segredo em `ARG`/`ENV`/`COPY`.
  - Os campos pré/pós-deploy do Coolify não recebem entrada externa (CVE-2026-34152, corrigida na `4.0.0-beta.471`).
- **Premissas não verificadas (a provar na VPS; o resultado vai no "Resultado" do plano):**
  - Contêiner novo que não fica `healthy` não substitui o atual (deploy com migration quebrada em app de teste; a versão antiga continua respondendo).
  - O `HEALTHCHECK` da imagem é o usado, com o `start-period` (`docker inspect`: `Health` e `Healthcheck`).
  - Variáveis do painel entram só em runtime (`docker history` sem segredo).
  - Postgres acessível pela Internal URL (`docker exec` na app).
  - Versão do Coolify ≥ `4.0.0-beta.471`.
  - Lock do Prisma serializa dois `migrate deploy` simultâneos.
  - Agendamento e restauração de backup.
- Regras: nenhuma de `docs/domain.md` muda. Planos: `docs/plans/2026-10-15-migrations-coolify.md`, `docs/plans/2026-10-15-dockerfile-producao.md`.
