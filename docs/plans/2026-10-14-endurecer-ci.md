# Plano: endurecer o CI (lint sem `--fix`, testes unitários, testes dos hooks, varreduras de segurança)

> O humano aprova antes de o `implementador` começar. O plano preenchido, com o "Resultado" ao concluir, é o registro da tarefa.

Aprovado por: humano em 2026-10-14
Modelo recomendado: Opus 5.5 (o da sessão) — mudança pequena em zona de risco (`.github/workflows/`); não pede troca de modelo.

## Intenção
O CI deixa de corrigir lint sozinho e passa a falhar com suíte unitária quebrada, lint sujo ou teste de hook quebrado (foi assim que o PR #18 passou). A segurança entra pelo que o GitHub já oferece de graça a repositório público: secret scanning (já ligado), Dependabot alerts + grafo de dependências e CodeQL em configuração padrão (configuração do repositório, ação do humano), mais um job `dependency-review` que barra PR que **introduza** dependência vulnerável `high` ou pior. O `JWT_SECRET` do CI vira um valor obviamente falso.

## Diagnóstico (conferido por comando nesta sessão, na `main` limpa `0c12180`)
- Retomada em `0cbb3ee` (PRs #23 e #24): `git diff --stat 0c12180 main -- .github package.json` só mostra `.github/pull_request_template.md`; `ci.yml` e `package.json` inalterados. `docs/architecture.md` e `docs/STATUS.md` foram removidos em `e88cf39` (conteúdo no manual).
- `.github/workflows/ci.yml:47-48`: o passo "Linter" roda `npm run lint`, que é `eslint ... --fix` (`package.json`). Não há passo de `npm test` nem dos testes dos hooks.
- `.github/workflows/ci.yml:53,59`: `JWT_SECRET: "svfqWsJ+8TlLeWzTI5C0bRIFkDepy6gcXsxduW5tVrA="` (parece segredo real). Só o `ci.yml` usa esse valor (`grep -rn` em `src test .github docs docker-compose.yml`).
- O workflow não tem bloco `permissions`; o padrão do repositório é `read` (`gh api .../actions/permissions/workflow` → `"default_workflow_permissions":"read"`).
- Linha de base local, todos passam: `npm run lint:check` (sem saída de erro), `npm test -- --silent` → `Test Suites: 3 passed`, `node --test '.claude/hooks/*.test.mjs'` → `pass 177, fail 0`, inclusive **sem** `CLAUDE_PROJECT_DIR` no ambiente (como no runner do CI).
- `npm audit`: `{ moderate: 3, high: 9, critical: 2, total: 14 }`; `npm audit --omit=dev`: 9 (1 critical, 7 high, 1 moderate), entre elas `@nestjs/platform-express` e `prisma` (diretas). **Um `npm audit` bloqueante deixaria o CI vermelho desde já**; por isso a decisão abaixo.
- O que o GitHub já oferece para este repositório (`gh repo view` → `"visibility":"PUBLIC"`, conta `User`; `gh api repos/jonatasmota404/exactafit-api`):
  - `secret_scanning: enabled`, `secret_scanning_push_protection: enabled` → **já atende a varredura de segredos**. `secret-scanning/alerts` → 0 alertas. (`non_provider_patterns` e `validity_checks`: `disabled`.)
  - `dependabot_security_updates: disabled`; `vulnerability-alerts` → `404` (Dependabot alerts desligado); `dependency-graph/sbom` → `404` (grafo de dependências aparentemente desligado; o `dependency-review` depende dele).
  - `code-scanning/default-setup` → `"state":"not-configured"`, linguagens detectadas `actions, javascript-typescript`.
  - Proteção da `main`: `contexts: ["build-and-check"]`, `strict: false`.
- `actions/dependency-review-action`: release mais recente `v5.0.0` (2026-05-08). README: exemplos com `permissions: contents: read`; `pull-requests: write` só é exigido com `comment-summary-in-pr` (padrão `never`); input `fail-on-severity` (padrão `low`). Funciona em repositório público sem licença GHAS.

## Decisões (do humano, nesta sessão)
- Auditoria de dependências: **bloquear só o novo**. Job separado `dependency-review`, só em `pull_request`, `fail-on-severity: high`, permissões mínimas (`contents: read`). O estoque atual vira tarefa própria (abaixo).
- Dependabot alerts + grafo de dependências e CodeQL padrão: configuração do repositório, **ação do humano**. Atualizações automáticas de versão do Dependabot ficam **desligadas** por ora.
- Varredura de segredos e análise estática: preferir o nativo do GitHub, por configuração, sem workflow novo.

Decidido por padrão (barato de reverter, registrado aqui):
- Bloco `permissions: contents: read` no topo do workflow: deixa o mínimo explícito no arquivo, sem depender da configuração do repositório. SUGESTÃO(IA, não confirmada).
- Valor falso do segredo: `JWT_SECRET: "ci-only-fake-jwt-secret-not-a-real-secret"`. Se o e2e acusar tamanho mínimo, alongar mantendo o texto obviamente falso.
- Testes dos hooks entram no `build-and-check` (não em job novo): são rápidos (~5 s) e o check já é obrigatório.

## Critérios de aceite
- [ ] No PR desta tarefa, o check `build-and-check` (mesmo nome) roda, nesta ordem e com sucesso: typecheck → `npm run lint:check` → `npm test` → `node --test '.claude/hooks/*.test.mjs'` → migrations → e2e.
- [ ] `grep -n "npm run lint$" .github/workflows/ci.yml` não retorna nada (nenhum passo com `--fix` no CI).
- [ ] `grep -rn "svfqWsJ" .github` não retorna nada; o e2e passa com o segredo falso.
- [ ] No PR desta tarefa, aparece um check `dependency-review` que roda e passa (o PR não muda dependências). Em `push` na `main` esse job não roda.
- [ ] O job `dependency-review` declara só `contents: read` e `fail-on-severity: high`.
- [ ] (Ação do humano, conferível por comando) `gh api repos/jonatasmota404/exactafit-api/vulnerability-alerts -i` → `204`; `gh api repos/jonatasmota404/exactafit-api/code-scanning/default-setup --jq .state` → `configured`.
- [ ] Typecheck, testes unitários e lint passam localmente.

## Risco
- **Nível:** médio.
- **Toca zona de risco?** sim: `.github/workflows/ci.yml`.
- **O que pode quebrar:**
  - Erro de YAML ou de nome do job → `build-and-check` some ou não reporta → nenhum PR pode ser mergeado (a proteção exige o check). Mitigação: nome do job não muda; o PR desta tarefa prova o check verde antes do merge.
  - `dependency-review` falha se o grafo de dependências estiver desligado. Mitigação: o humano liga Dependabot alerts (ação A) **antes** de abrir o PR; se ainda falhar, é esse o diagnóstico.
  - Se `dependency-review` virar obrigatório e um PR futuro não disparar o workflow, o PR fica preso esperando. Mitigação: o job não tem filtro de `paths`, então roda em todo PR para `main`.
  - Um PR futuro que só toque deps já vulneráveis em versões ainda vulneráveis pode falhar no `dependency-review`; é o comportamento desejado.

## Menor esforço
Menor esforço: considerei gitleaks/trufflehog (segredos), `npm audit` bloqueante, CodeQL em workflow avançado e Semgrep; escolhi o que o GitHub já dá de graça a repositório público (secret scanning com push protection, já ligado; Dependabot alerts e CodeQL padrão, só configuração) mais uma única action oficial do GitHub (`dependency-review`), porque cobre os três pedidos sem manter workflow de terceiros e sem deixar o CI vermelho por passivo fora de escopo.

## Segurança (risco médio)
- **Segredos:** o valor atual do `JWT_SECRET` no `ci.yml` sai do arquivo, mas continua no histórico do git (público). O humano confirmou que nunca foi usado fora do CI (Pergunta 1): sem rotação. Verificação: `grep -rn "svfqWsJ" .github` vazio.
- **Dependências:** sem dependência npm nova. Action nova `actions/dependency-review-action@v5` (publicada pelo próprio GitHub, mesma política de tag das actions já usadas, `@v4`). Permissão do token: `contents: read` no workflow inteiro.
- **Entrada externa:** `pull_request` (não `pull_request_target`): PR de fork roda sem segredos e com token só leitura.
- **Não se aplica agora:** fixar actions por SHA (`sha_pinning_required: false`; as actions atuais também usam tag) → fora de escopo, ver abaixo.

## Tarefas (um commit cada)
Branch: `chore/endurecer-ci`, nascida da `main`.

0. **(Humano, antes do PR)** Ações A e B da seção "Ações do humano".
1. `ci(build-and-check): lint sem --fix, testes unitários e dos hooks, JWT_SECRET falso` — em `ci.yml`: bloco `permissions: contents: read` no topo; passo "Linter" → `npm run lint:check`; passos novos `npm test` e `node --test '.claude/hooks/*.test.mjs'` após o lint; `JWT_SECRET` falso nos dois passos. Sem impacto em doc: CI não muda rota, schema nem regra; a descrição do CI e a fila agora ficam no manual.
2. `ci(dependency-review): barra PR que introduz dependência vulnerável high+` — job `dependency-review` em `ci.yml`, com `if: github.event_name == 'pull_request'`, `permissions: contents: read`, `actions/checkout@v4` + `actions/dependency-review-action@v5` com `fail-on-severity: high`. Sem impacto em doc: CI não muda rota, schema nem regra; a descrição do CI e a fila agora ficam no manual (a pendência "atualizar dependências vulneráveis de produção" vai só no bloco "Para o manual").

Esboço do job (o `implementador` ajusta só formatação):
```yaml
  dependency-review:
    if: github.event_name == 'pull_request'
    runs-on: ubuntu-latest
    permissions:
      contents: read
    steps:
      - uses: actions/checkout@v4
      - uses: actions/dependency-review-action@v5
        with:
          fail-on-severity: high
```

Diff estimado: ~30 linhas de workflow + ~10 de docs.

## Arquivos a tocar
| Arquivo | Mudança |
|---|---|
| `.github/workflows/ci.yml` | `permissions`, lint:check, npm test, testes dos hooks, `JWT_SECRET` falso, job `dependency-review` |
| `docs/RETRO.md` | linha ao fechar a tarefa |
| `docs/plans/2026-10-14-endurecer-ci.md` | seção "Resultado" |

## Abstrações novas
- Nenhuma.

## Dependências novas
- Nenhuma dependência npm. Action nova no CI: `actions/dependency-review-action@v5` (oficial do GitHub), aprovada pelo humano nesta sessão (opção 1).

## Ações do humano (configuração do repositório, fora do código)
**A. Dependabot alerts + grafo de dependências** (antes do PR):
- Interface: <https://github.com/jonatasmota404/exactafit-api/settings/security_analysis> → **Dependabot alerts** → **Enable**. Ao ligar, o GitHub liga o **Dependency graph** se ainda estiver desligado; se aparecer separado na página, ligue-o também. **Não** ligue "Dependabot security updates" nem "version updates" (crie nada em `.github/dependabot.yml`). Rótulos exatos da página: não verificado (o caminho da URL é o da página "Code security / Advanced Security").
- Equivalente no terminal: `gh api -X PUT repos/jonatasmota404/exactafit-api/vulnerability-alerts`
- Conferir: `gh api repos/jonatasmota404/exactafit-api/vulnerability-alerts -i | head -1` → `HTTP/2.0 204`.

**B. CodeQL em configuração padrão** (antes ou depois do PR; independe dele):
- Interface: mesma página → **Code scanning** → **CodeQL analysis** → **Set up** → **Default** → **Enable CodeQL**.
- Equivalente no terminal: `gh api -X PATCH repos/jonatasmota404/exactafit-api/code-scanning/default-setup -f state=configured -f query_suite=default`
- Conferir: `gh api repos/jonatasmota404/exactafit-api/code-scanning/default-setup --jq .state` → `configured`. Os achados aparecem em Security → Code scanning e **não bloqueiam** PR (corrigi-los é tarefa própria).

**C. Tornar `dependency-review` obrigatório** (depois de vê-lo verde no PR desta tarefa; adiciona o contexto sem mexer no `build-and-check`):
```bash
gh api -X POST repos/jonatasmota404/exactafit-api/branches/main/protection/required_status_checks/contexts -f 'contexts[]=dependency-review'
# conferir:
gh api repos/jonatasmota404/exactafit-api/branches/main/protection/required_status_checks --jq .contexts
# esperado: ["build-and-check","dependency-review"]
```
Observação: adicionado por esse endpoint, o contexto aceita qualquer origem (sem `app_id`), diferente do `build-and-check` (`app_id: 15368`, GitHub Actions). Para fixar a origem seria preciso reescrever a proteção, o que está fora de escopo.

**Varredura de segredos:** nada a fazer; secret scanning e push protection já estão ligados (verificado). Opcional, adiado: `non_provider_patterns` (pega segredos genéricos como o `JWT_SECRET` atual); disponibilidade gratuita em repositório público não verificada. Revisitar se um segredo genérico vazar.

## Como verificar
```bash
npm run typecheck
npm test
npm run lint:check
node --test '.claude/hooks/*.test.mjs'
grep -n "npm run lint$" .github/workflows/ci.yml   # vazio
grep -rn "svfqWsJ" .github                         # vazio
# e2e com o segredo falso:
docker compose up -d && npx prisma migrate deploy
JWT_SECRET=ci-only-fake-jwt-secret-not-a-real-secret npm run test:e2e
```
Manual, no PR: `gh pr checks <n>` mostra `build-and-check` e `dependency-review` com `pass`; no log do `build-and-check`, os passos de lint:check, testes unitários e testes dos hooks aparecem e passam. Ações A e B conferidas pelos comandos acima.

## Documentação (definição de pronto)
- [x] Sem impacto em doc: CI não muda rota, schema nem regra de negócio; a escolha de ferramentas de CI é reversível por configuração. `docs/architecture.md` e `docs/STATUS.md` não existem mais (`e88cf39`); a descrição do CI e a fila vivem no manual, alimentado pelo bloco "Para o manual" (ajuste aprovado pelo humano em 2026-10-14).

## Fora de escopo
- Alterar a proteção de branch (a ação C é do humano).
- Corrigir os achados das varreduras. Vira tarefa própria: **"atualizar dependências vulneráveis de produção"** — **antes do primeiro deploy**, risco **médio a alto** (pode exigir atualização maior de Nest e Prisma; 9 vulnerabilidades em `--omit=dev`, 1 critical e 7 high, em 2026-10-14). Também viram tarefas próprias os achados do CodeQL, se houver.
- Ligar Dependabot security updates / version updates.
- Fixar actions por SHA; trocar a senha do Postgres de teste (`postgrespassword`, só do container de serviço do CI).
- Exigir resultado do CodeQL como check obrigatório (seria regra de proteção/ruleset).
- `U8` (remover o fallback do `JWT_SECRET` em `src/auth/auth.module.ts`): tarefa própria já registrada em `docs/domain.md`.

## Perguntas para o humano
1. O valor atual do `JWT_SECRET` do `ci.yml` (`svfqWs...`) foi usado em algum ambiente fora do CI (seu `.env` local, Coolify)? Ele continua no histórico público do git. Se sim, troque-o lá; se não, nada a fazer.
2. Confirma o nome `dependency-review` para o job novo (é o nome que entra na proteção no comando C)?

Respostas (humano, 2026-10-14):
1. O `svfqWs...` só existiu no CI e nunca foi usado fora dele (a API roda só local, não está no Coolify). Sem rotação em produção.
2. `dependency-review` confirmado.

Ações A e B feitas pelo humano e conferidas: `vulnerability-alerts -i` → `HTTP/2.0 204 No Content`; `code-scanning/default-setup --jq .state` → `configured`.

## Resultado (preencher ao concluir)
- **O que foi feito:** tarefas 1 e 2 no `.github/workflows/ci.yml`: `permissions: contents: read` no topo; `lint:check` no lugar de `lint`; passos "Testes unitários" e "Testes dos hooks"; `JWT_SECRET` falso; job `dependency-review` (só em PR, `contents: read`, `fail-on-severity: high`). No PR #25: `build-and-check` pass (1m12s; log: unit `3 passed`, hooks `pass 177, fail 0`, e2e `74 passed, 3 todo`), `dependency-review` pass (6s), CodeQL pass.
- **Desvios do plano:** na retomada, a `main` estava em `0cbb3ee` e `docs/architecture.md`/`docs/STATUS.md` já não existiam (`e88cf39`); com aprovação do humano, as tarefas passaram a "Sem impacto em doc" e a pendência de dependências foi só para "Para o manual". Linhas só com espaços adjacentes às alterações viraram linhas vazias.
- **Pendências:** ação C (humano: tornar `dependency-review` obrigatório, comando acima); tarefa "atualizar dependências vulneráveis de produção" (antes do primeiro deploy); revisor, MENOR: `permissions` repetido no job `dependency-review` (mantido, pedido pelo plano).
- **PR/commit:** PR #25; `0537625` (plano), `3bf2c53` (tarefa 1), `0f2bb03` (tarefa 2), mais o commit deste registro.
- **Docs atualizadas:** sem impacto em doc (ver "Documentação"); este "Resultado" e `docs/RETRO.md`.

| Etapa | Modelo | Retrabalho | Erro pego por | Tempo |
|---|---|---|---|---|
| Plano | Opus 5.5 | ajuste de docs na retomada (arquivos removidos depois do plano) | agente, na retomada | não medido |
| Testes | Opus 5.5 | nenhum | — | não medido |
| Implementação | sonnet (`implementador`) | nenhum | — | 135 s |
| Revisão | opus (`revisor`) | nenhum (2 MENORES, sem correção de código) | — | 133 s |

### Para o manual
- **O que mudou no comportamento:** o CI falha (em vez de corrigir) com lint sujo, e falha com teste unitário ou de hook quebrado; PR que introduz dependência vulnerável `high`+ é barrado pelo `dependency-review`.
- **Decisões novas em domain/ADR:** nenhuma.
- **Pendência para a fila do manual:** tarefa "atualizar dependências vulneráveis de produção", antes do primeiro deploy, risco médio a alto.
- **O que o humano precisa entender:** há 9 vulnerabilidades de produção conhecidas (1 critical, 7 high) que o CI **não** barra, porque só bloqueia o que é novo; a tarefa "atualizar dependências vulneráveis de produção" precisa acontecer **antes do primeiro deploy**. Alertas do Dependabot e do CodeQL aparecem na aba Security e não bloqueiam merge.
