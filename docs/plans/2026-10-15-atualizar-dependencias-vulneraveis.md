# Plano: atualizar as dependências vulneráveis de produção (`npm audit --omit=dev`)

> O humano aprova antes de o `implementador` começar. O plano preenchido, com o "Resultado" ao concluir, é o registro da tarefa.

Aprovado por: **humano, em 2026-10-16** — PR 1 (parte A): `npm audit fix --omit=dev` só no lockfile, `@nestjs/common` e `@nestjs/core` alinhados a 11.2.7; fora do escopo: override de `mysql2`, `deepmerge-ts` 8 e a cadeia do `prisma` (PR 2, reaberto por E1); `trust proxy` segue desligado. **PR 2 continua pendente de aprovação.**
Modelo recomendado: Sonnet 5.5 (o da sessão) — tarefa mecânica, mas em zona de risco (`package.json`); o que pesa é a verificação, não o modelo.

## Intenção
Zerar, antes do primeiro deploy, as vulnerabilidades que `npm audit --omit=dev` acusa hoje (9: 1 critical, 7 high, 1 moderate). O CI só barra vulnerabilidade **nova** (`dependency-review`), então o estoque precisa ser tratado à parte. A tarefa se divide em duas partes de risco diferente: o que `npm audit fix` resolve sem quebra e a cadeia do `prisma`, que não tem correção sem major ou sem override.

## Diagnóstico (conferido por comando nesta sessão, na `main` limpa `cc7e328`)
Comandos: `npm audit --omit=dev --json`, `npm audit fix --dry-run --omit=dev`, `npm ls <pacote> --omit=dev`, `npm view <pacote> ...`. Total: `{ moderate: 1, high: 7, critical: 1 }`.

| # | Pacote (severidade) | Direta? | Caminho (`npm ls`) | Corrigida em | Major? | Alcançável no projeto? |
|---|---|---|---|---|---|---|
| 1 | `proxy-addr` (**critical**) — spoofing de IP via sub-rede IPv4-mapeada confiável (GHSA-jqcg-44mw-7w3h) | transitiva | `@nestjs/platform-express` → `express@5.2.1` → `proxy-addr@2.0.7` | `2.0.8` (`npm audit fix`) | não | **Hoje não**: `express` usa `trust proxy = false` (`node_modules/express/lib/application.js:99`) e `src/main.ts` não o altera; nenhum código lê `req.ip`. **Passa a ser** se o deploy ficar atrás de proxy e alguém ligar `trust proxy`. |
| 2 | `multer` (high; 5 avisos, DoS em upload multipart) | transitiva | `@nestjs/platform-express` → `multer@2.2.0` | `2.4.0` (vem com `@nestjs/platform-express@11.2.7`) | não | **Não**: não há `FileInterceptor`/upload em `src/` (`grep` vazio) e nenhuma rota recebe `multipart/form-data`. |
| 3 | `@nestjs/platform-express` (high; só via `multer`) | **direta** (`^11.0.1`, instalada `11.2.1`) | — | `11.2.7` (`npm audit fix`) | não | Igual ao item 2. |
| 4 | `qs` (moderate; array-limit e DoS via `isBuffer`) | transitiva | `express@5.2.1` → `qs@6.15.3`; `body-parser@2.3.0` → `qs` | `6.16.1` (`npm audit fix`) | não | **Sim, em parte**: o Nest registra `express.urlencoded({ extended: true, ... })` (`node_modules/@nestjs/platform-express/adapters/express-adapter.js:191`), então corpo `application/x-www-form-urlencoded` em qualquer rota (inclusive `POST /auth/login`) passa pelo `qs`. O parser de query do Express 5 é `simple` (`application.js:97`), não usa `qs`. |
| 5 | `fast-uri` (high; 6 avisos, SSRF/host confusion) | transitiva | `@prisma/client` → `prisma` → `@prisma/dev` → `@prisma/streams-local` → `ajv@8.20.0` → `fast-uri@3.1.5` | `3.1.8`+ (`npm audit fix`; `latest` 4.2.2) | não | **Não**: só dentro do CLI/dev do Prisma; o app não faz parse de URI com ele. |
| 6 | `prisma` (high; só via os 3 abaixo) | **dev** (`devDependencies: ^7.9.1`), mas **instalado em produção** (ver abaixo) | `@prisma/client@7.9.1` → `prisma@7.9.1` | **sem correção em 7.x** (`7.10.0` ainda traz `mysql2 3.15.3`, `deepmerge-ts 7.1.5`); `audit fix --force` propõe `prisma@6.19.3` = **downgrade** de major (inaceitável, o código é Prisma 7 + adapter-pg) | — | **Não no app** (usa `@prisma/client` + `@prisma/adapter-pg`); sim no CLI (`npx prisma migrate deploy` do CI, `prisma generate`). |
| 7 | `@prisma/config` (high; via `deepmerge-ts`) | transitiva | `prisma` → `@prisma/config@7.9.1` | só com `deepmerge-ts@8` (`7.10.0` ainda depende de `7.1.5`) | — | **Não**: carrega o `prisma.config.ts` do próprio repositório. |
| 8 | `deepmerge-ts` (high; estouro de pilha com grafo recursivo, GHSA-ggr8-5vv4-36mx) | transitiva | `@prisma/config` → `deepmerge-ts@7.1.5` | `8.0.0` (**major**; `latest` 8.0.2) | **sim** | **Não**: só mescla a config do projeto, que é entrada confiável. |
| 9 | `mysql2` (high; vazamento de senha por downgrade de plugin, DoS de zlib) | transitiva | `prisma` → `mysql2@3.15.3` (versão fixa) | `3.24.x` (`latest` 3.24.6) | minor dentro de 3.x | **Não**: projeto é só PostgreSQL; `mysql2` fica no CLI para o provider MySQL. |

**Fato que muda a conversa:** `prisma` está em `devDependencies`, mas entra na árvore de produção como peer opcional de `@prisma/client`. `package-lock.json` marca `prisma`, `@prisma/config`, `deepmerge-ts`, `mysql2` e `fast-uri` como `devOptional`, e um `npm ci --omit=dev` num diretório limpo **instalou os cinco** (e `multer`). Ou seja: "é só dev" **não** é verdade para o `npm audit --omit=dev` nem para uma imagem de deploy feita assim. O que o app executa em runtime continua sendo `@prisma/client` + `@prisma/adapter-pg`.

Observações:
- `@nestjs/common` e `@nestjs/core` estão em `11.2.1` (`wanted 11.2.7`); não são vulneráveis. Alinhar com o `platform-express@11.2.7` é opcional (Pergunta 2).
- `prisma@8.0.0-rc.23` existe, mas é release candidate com árvore nova (`@prisma/compute-sdk`, `@prisma/composer-cli`...). **Descartado**: RC, mudança de major do CLI e dependências novas (regra 3 do `AGENTS.md`).

## Atualização de 2026-10-16: PR 2 reaberto (E1)
Decisão do humano (ADR 0010, plano `2026-10-15-migrations-coolify.md`): o deploy roda `prisma migrate deploy` **no start do contêiner**, então o CLI do Prisma e a cadeia dele **estão** na imagem de runtime. Responde à Pergunta 1 (o CLI "é produção") e invalida a hipótese de que a cadeia sai do runtime.
- **PR 2 reaberto:** override de `mysql2` na mesma major (`^3.24.6`) e `deepmerge-ts` 8 em commit separado; se a 8 quebrar o CLI (`prisma validate`/`generate`/`migrate deploy`), reverter esse commit e **aceitar o resíduo** de `deepmerge-ts` (e do que depender dele) com gatilho de revisão: novo `prisma` 7.x ou fim do RC do 8.
- **Nova verificação obrigatória:** `prisma migrate deploy` **dentro da imagem final** (Dockerfile), não só no host.
- **Critério final de audit:** `npm audit --omit=dev` (sem `--omit=optional`). Medido na `main` com a imagem: 9 (1 critical, 7 high, 1 moderate); com `--omit=optional`: 4 (1 critical, 2 high, 1 moderate).
- Alcançabilidade: continua "não alcançável no app", mas o CLI agora roda dentro do contêiner exposto (com a rede do Coolify e `DATABASE_URL`) a cada start.
- **Não implementado nesta tarefa.** Os PRs 1 e 2 seguem como descritos abaixo, ainda sem aprovação.

## Decisões (padrão; baratas de reverter)
- **Parte A** (itens 1–5): `npm audit fix --omit=dev`, sem `--force`. Só `package-lock.json`; `package.json` muda no máximo o piso de `@nestjs/platform-express` se o npm o ajustar. SUGESTÃO(IA, não confirmada).
- **Parte B** (itens 6–9): recomendo **override** só de `mysql2` (minor, mesma major) e **não** subir `deepmerge-ts` para a major 8 sem teste do CLI; decisão é do humano (Pergunta 1), porque depende de como o deploy roda as migrations.

## Ordem de atualização e riscos
1. **A. Sem quebra** (`npm audit fix --omit=dev`): `proxy-addr` 2.0.7→2.0.8, `qs` 6.15.3→6.16.1, `fast-uri`→≥3.1.8, `multer` 2.2.0→2.4.0 (com `@nestjs/platform-express` 11.2.7). Todos semver-compatíveis, sem major. Risco: parser de corpo (`qs`) e carregamento do Express. Esperado: sobram 4 `high` (cadeia `prisma`). **Não verificado até rodar de verdade.**
2. **B1. `mysql2` por override** (`"overrides": { "mysql2": "^3.24.6" }` no `package.json`): remove os 2 avisos de `mysql2`. Breaking changes: nenhuma conhecida dentro de 3.x; o app não carrega `mysql2`. Risco: o CLI do Prisma pina `3.15.3` de propósito; só afeta o provider MySQL, que o projeto não usa.
3. **B2. `deepmerge-ts` 7→8** (override, **major**): remove o aviso de `@prisma/config`/`prisma`. Risco: `@prisma/config@7.x` foi escrito contra a API 7.x; se a 8 mudar o contrato, `prisma generate`/`migrate deploy` quebram — e **isso fica entre o CI e o deploy**. Só entra se `npx prisma validate`, `generate` e `migrate deploy` passarem localmente e no CI.
4. **B3. Aceitar o resto, documentado:** se B2 falhar, ficam `prisma`, `@prisma/config` e `deepmerge-ts` no relatório com justificativa de alcançabilidade (todas "não alcançável no app") até o Prisma publicar um 7.x corrigido; gatilho de revisão: nova versão de `prisma` 7.x ou fim do RC do 8.

**Overrides — quando usar e quando não:** usar para transitiva **sem correção upstream** cujo pacote substituto é semver-compatível e fora do caminho de runtime do app (caso `mysql2`). **Não** usar quando: (a) já existe versão do pai que corrige (preferir atualizar o pai: caso `multer` via `platform-express`); (b) o substituto é major e quem consome é código que o projeto não testa (caso `deepmerge-ts`, só com teste do CLI); (c) o pacote está no caminho quente do app (`express`, `jsonwebtoken`, `bcrypt`): override esconde incompatibilidade que só aparece em produção; (d) o override é a única barreira e ninguém vai lembrar de removê-lo — registrar o gatilho de remoção no plano.

## Critérios de aceite
- [ ] Parte A: `npm audit --omit=dev` não lista mais `proxy-addr`, `multer`, `@nestjs/platform-express`, `qs` nem `fast-uri` (saída colada no Resultado).
- [ ] Parte B (conforme decisão): `npm audit --omit=dev` lista só o que o humano aceitou, cada um com justificativa; ou zero.
- [ ] `POST /auth/register`, `POST /auth/login` e `GET /` continuam com os mesmos status (suíte e2e verde).
- [ ] `npx prisma validate`, `npx prisma generate` e `npx prisma migrate deploy` funcionam (CLI do Prisma não quebrou).
- [ ] Typecheck, testes unitários, lint e build passam.

## Testes (escritos antes do código)
Sem teste novo: atualização de dependência sem mudança de comportamento; a cobertura é a suíte existente. Os pontos que mexem em código indireto já têm teste:

| O que pode mudar | Teste existente que cobre | Arquivo |
|---|---|---|
| Parsing de corpo (`qs`/`body-parser`) em registro e login | cadastro e login com JSON válido/inválido, e-mail duplicado, credencial errada | `test/auth.e2e-spec.ts` |
| `AuthGuard` e JWT (`@nestjs/jwt` não muda, mas roda sobre o Express atualizado) | token ausente/inválido/válido | `test/authguard-caracterizacao.e2e-spec.ts` |
| Boot do Nest e `GET /` | health check | `test/app.e2e-spec.ts` |
| Rotas de exercícios e fichas (corpo `ValidationPipe` + `forbidNonWhitelisted`) | caracterização e CRUD | `test/exercises-caracterizacao.e2e-spec.ts`, `test/routines*.e2e-spec.ts` |

Se algum desses falhar após a atualização: **não ajustar o teste**; parar e relatar (Regra de verificação 3).

## Risco
- **Nível:** médio.
- **Toca zona de risco?** sim: `package.json` e `package-lock.json`. **Indiretamente** `src/auth/` (corpo de `/auth/*` passa por `qs`/`body-parser`; JWT roda sobre o Express atualizado) — **nenhum arquivo de `src/auth/` muda**; a prova é `git diff --stat` sem `src/` e os e2e de auth verdes. Sem migrations nem `schema.prisma`.
- **O que pode quebrar:** (i) comportamento de `qs` em corpos urlencoded (muda limites de array); (ii) Express/Nest desalinhados se só `platform-express` subir; (iii) CLI do Prisma se `deepmerge-ts` 8 for forçado (o CI roda `prisma generate` e `migrate deploy`); (iv) lockfile alterado em dependências de dev sem querer (usar `--omit=dev` e conferir o diff).

## Menor esforço
Menor esforço: considerei `npm audit fix --force` (traria `prisma@6.19.3`, downgrade), subir para `prisma@8.0.0-rc.23` (RC, árvore nova) e overrides para tudo; escolhi `npm audit fix --omit=dev` para o que tem correção compatível e override pontual só onde o pai não corrige e o substituto é da mesma major, porque zera o crítico sem tocar em código nem em major.

## Segurança (risco médio, toca dependências)
- **Dependências:** nenhum pacote **novo**; só versões novas de pacotes já presentes. Conferir no registro antes de aprovar: `npm view multer@2.4.0 proxy-addr@2.0.8 qs@6.16.1 mysql2@3.24.6 time.modified maintainers` (a executar na implementação e colar no Resultado; versões com menos de ~30 dias seguem a regra 3 do `AGENTS.md` — conferir `time`).
- **Cadeia de suprimento:** `npm audit fix` pode resolver para a versão mais nova; fixar pelo `package-lock.json` revisado e **ler o diff do lockfile** (nomes de pacote novos = parar e relatar).
- **Alcançabilidade:** o único item crítico (`proxy-addr`) e o `qs` são os que tocam o caminho de requisição; os demais ficam no CLI.
- **Não se aplica agora:** autenticação, dados pessoais, segredos — nenhum código muda.

## Tarefas (um commit cada, branch nascida da `main`)
Divisão recomendada: **dois PRs**, porque a parte A é segura e o crítico não deve esperar a decisão da parte B.

**PR 1 — `chore/audit-fix-prod`**
1. `chore(deps): npm audit fix --omit=dev (proxy-addr, qs, multer, fast-uri)` — só lockfile (+ piso de `@nestjs/platform-express` se o npm ajustar). Rodar a bateria de verificação; colar `npm audit --omit=dev` antes e depois.

**PR 2 — `chore/audit-prisma-cli`** (depois do merge do PR 1; só começa com a resposta à Pergunta 1)
2. `chore(deps): override mysql2 ^3.24.6` — `package.json` + lockfile; `prisma validate/generate/migrate deploy`.
3. `chore(deps): override deepmerge-ts ^8` — **commit separado, reversível**; se `prisma` falhar, reverter este commit e ir para B3.
4. `docs(plans): resultado` — "Resultado" e o que ficou aceito, com gatilho de revisão.

## Arquivos a tocar
| Arquivo | Mudança |
|---|---|
| `package-lock.json` | versões resolvidas |
| `package.json` | PR 1: no máximo o piso de `@nestjs/platform-express`; PR 2: bloco `overrides` |
| `docs/plans/2026-10-15-atualizar-dependencias-vulneraveis.md` | "Resultado" |
| `docs/RETRO.md` | linha da tarefa |

Nenhum arquivo em `src/`, `test/`, `prisma/` ou `.github/`. Qualquer um deles no diff é suspeito.

## Abstrações novas
- Nenhuma.

## Dependências novas
Nenhuma (só atualização de versões já presentes; ver "Segurança").

## Como verificar
```bash
# antes (linha de base) e depois de cada PR
npm audit --omit=dev
git diff --stat main -- src test prisma .github   # deve ser vazio
npm run typecheck
npm test
npm run lint:check
npm run build
docker compose up -d && npx prisma migrate deploy && npm run test:e2e
npx prisma validate && npx prisma generate
# prova de que o que vai para produção ficou limpo
npm ci --omit=dev --ignore-scripts && npm audit --omit=dev
```
Manual: subir a API e chamar `GET /`, `POST /auth/register` e `POST /auth/login` com `application/json` **e** com `application/x-www-form-urlencoded` (confirma o caminho do `qs`).

## Documentação (definição de pronto)
- [ ] Atualiza: `docs/domain.md` | ADR
- [x] Sem impacto em doc: atualização de dependência não muda rota, schema nem regra. Se o humano aceitar vulnerabilidades da cadeia `prisma` (B3), o registro de aceite e o gatilho vão no "Resultado" e em "Para o manual"; avaliar ADR só se virar política (Pergunta 3).

## Fora de escopo
- Atualizar `@nestjs/*` para a major 12, `typescript` 7, `dotenv` 18, `@types/node` 26 (não são vulnerabilidades).
- Subir `prisma` para 8 (RC).
- Auditar `devDependencies` (`npm audit` completo: 14 no total).
- Fixar actions do GitHub por SHA; ligar Dependabot (ação do humano, ver plano do CI).
- Qualquer mudança em `src/auth/` ou na lógica de `trust proxy` (a decidir no deploy).

## Perguntas para o humano
1. **Como o deploy roda as migrations?** Se a imagem instala com `npm ci --omit=dev` e roda `prisma migrate deploy`, o CLI do Prisma **é** produção e a cadeia `prisma` precisa de B1/B2; se as migrations rodam no CI/outro passo e a imagem só leva `dist/` + `@prisma/client`, a cadeia `prisma` pode sair de produção (instalar sem peers opcionais) e o problema desaparece sem override. Recomendo definir isso **antes** da parte B. **Respondida em 2026-10-16:** o CLI roda no start do contêiner (ver "Atualização de 2026-10-16"); a parte B continua necessária.
2. **Alinhar `@nestjs/common` e `@nestjs/core` para 11.2.7** junto com `platform-express`? Recomendo sim (mesmo patch, evita desalinhamento); custo: 2 linhas a mais de lockfile e mesma bateria de testes.
3. **Aceitar risco residual documentado** (B3) caso `deepmerge-ts` 8 quebre o CLI, ou bloquear o deploy até haver 7.x corrigido? Recomendo aceitar com gatilho de revisão: os 4 avisos restantes não são alcançáveis no app.
4. **`trust proxy`:** o deploy ficará atrás de proxy/PaaS? Se sim, o crítico do `proxy-addr` deixa de ser teórico e o PR 1 vira pré-requisito do deploy (já é, mas com prazo).

## Resultado (PR 1, parte A, 2026-10-16)
- **O que foi feito:** branch `chore/audit-fix-prod` (da `main` `e56353e`), só `package-lock.json`. Subiram: `proxy-addr` 2.0.7→2.0.8, `qs` 6.15.3→6.16.1, `fast-uri` 3.1.5→3.1.8, `multer` 2.2.0→2.4.0 (saiu `concat-stream`/`typedarray`), `@nestjs/platform-express`, `@nestjs/common` e `@nestjs/core` 11.2.1→11.2.7. `package.json` intacto. Todos os `resolved` seguem em `registry.npmjs.org`; nenhum pacote novo.
- **Desvio do plano (importante):** `npm audit fix --omit=dev` **puro** foi executado e descartado. Ele também subia a cadeia do Prisma (`prisma`/`@prisma/*` 7.9.1→7.10.1, engines 7.9.0→8.1.0, `deepmerge-ts` 7.1.5→8.0.2, `mysql2` 3.15.3→3.24.4) e zerava o audit, mas isso é escopo do PR 2 e `prisma@7.10.1` foi publicado em 2026-10-15 (1 dia; regra 3 pede ~30 dias). Apliquei só `npm update proxy-addr qs fast-uri multer @nestjs/platform-express @nestjs/common @nestjs/core --ignore-scripts`. O lockfile do `audit fix` completo ficou só no scratchpad da sessão (não versionado).
- **Audit antes → depois** (`npm audit --omit=dev`): 9 (1 critical, 7 high, 1 moderate) → **4 (4 high: `prisma`, `@prisma/config`, `deepmerge-ts`, `mysql2`)**. Com `--omit=optional`: 4 (1 critical, 2 high, 1 moderate) → **0**. `proxy-addr`, `multer`, `@nestjs/platform-express`, `qs` e `fast-uri` não aparecem mais.
- **Verificação (tudo passou):** typecheck; unitários 3/3; lint:check; build; e2e (Postgres descartável em porta própria, 6 suítes, 74 passed + 3 todo; o log de erro de FK no e2e é de teste de caracterização esperado). Imagem do Dockerfile contra Postgres vazio: 6 migrations aplicadas no start, `GET /` 200 `{"status":"ok"}`, `POST /auth/register` 201, `POST /auth/login` 200 (JSON e `application/x-www-form-urlencoded`, que exercita o `qs`), healthcheck `healthy`. `git diff --stat` vazio em `src/`, `test/`, `prisma/`, `.github/` e `Dockerfile`.
- **Pendências:** PR 2 (mysql2/deepmerge-ts/prisma). Nova informação para ele: `prisma@7.10.1` já traz `deepmerge-ts` 8 e `mysql2` 3.24 e zera o audit sem override, mas ainda não cumpre ~30 dias (elegível a partir de 2026-11-14); decidir entre esperar ou override. `npm audit --omit=dev` completo segue em 4 até lá.
- **PR/commit:** branch `chore/audit-fix-prod`; PR não aberto.
- **Docs atualizadas:** este plano. Sem impacto em doc (domain/ADR).

### Para o manual
- **O que mudou no comportamento:** nenhum.
- **Decisões novas em domain/ADR:** nenhuma.
- **O que o humano precisa entender:** o crítico (`proxy-addr`) saiu da imagem; restam 4 high só na cadeia do CLI do Prisma, não alcançáveis no app. `npm ci --ignore-scripts` apaga o client gerado: rode `npx prisma generate` antes de typecheck/testes. O gatilho de `trust proxy` continua: reconferir `proxy-addr` ao ligá-lo.
