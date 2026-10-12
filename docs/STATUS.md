# Status do projeto
> Atualizado em 2026-10-12, conferido por comando na branch `docs/caso1-ajustes` (base `main` = `16e354a`). O agente atualiza ao fim de cada tarefa (máx. 30 linhas).
## Estado atual
- **Main:** `16e354a`. PRs #1 a #19 mergeados (`gh pr list --state all`). Proteção com PR e check `build-and-check` obrigatórios (relato anterior; não reverificado nesta sessão).
- **Código:** módulos `auth`, `exercises`, `routines`, `sessions`, `prisma`.
- **Sessions:** módulo sessions entrou na main via PR #18 sem plano nem revisão contra domain.md (S1–S9) e sem testes de caracterização; auditoria pendente antes de qualquer deploy.
- **Branch desta tarefa:** `docs/caso1-ajustes` (ajustes de doc do caso 1). `plan/caso1-put-name-null` foi mergeada no #19 e apagada (local e remota).
- **Testes (nesta branch):** typecheck sem erros; unitários 3/3; `lint:check` limpo; e2e completo 74 passed, 3 todo (Postgres local 5433).
- **Docs:** `domain.md`, `architecture.md`, ADRs 0001 a 0008, `PIPELINE.md`, `docs/plans/2026-10-12-caso1-put-name-null.md`.
## Divergências de `domain.md` (travadas por teste, sem correção)
- Routines: F4 faixas e `order` negativo, F11 `order` repetido, F10 sem limites, F6 `exerciseId` inexistente dá 500.
- Exercises: E1/E2 exercício sem dono, E4 `muscleGroup` livre e `type` aceito. AuthGuard: C1 não consulta o usuário.
## Fila de código (cada uma com plano aprovado, nesta ordem)
1. Auditar e travar o módulo sessions (S1–S9, testes de caracterização).
2. Endurecer o CI (manter o nome do job `build-and-check`, rodar unitários e `lint:check`).
3. F6: `exerciseId` inexistente → 400.
4. F4 e F11: faixas e `order` único. Inclui o trim do `name` no POST e no PUT (F2a) e um teste que trave `description: null` limpando a descrição (F2b).
5. C1: `AuthGuard` consulta o usuário (existe e está ativo).
6. Migration que remove `type` (E4, risco alto).
7. `doc-warning` avisar quando o STATUS não for tocado (item da retro).
8. `guard-main`: falso positivo em `git switch -c <branch> main && git merge ...` (lê o `main` do switch como branch ativa).
## Pendências do humano
- Revisar e mergear o PR de `docs/caso1-ajustes`.
- `TODO(humano)`: duração-alvo (F4), LGPD, licença da mídia, tradução, teto de fichas arquivadas, `npm ci --omit=dev` em produção.
- Aprovar a dependência nova da ficha por IA (ADR 0007).
