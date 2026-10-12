# Status do projeto
> Atualizado em 2026-10-12, conferido por comando na `main` (`5722f6e`). O agente atualiza ao fim de cada tarefa (máx. 30 linhas).
## Estado atual
- **Main:** `5722f6e`. PRs #1 a #16 mergeados (`gh pr list --state all`), nenhum aberto. Proteção com PR e check `build-and-check` obrigatórios (relato do STATUS anterior; não reverificado nesta sessão).
- **Código:** módulos `auth`, `exercises`, `routines`, `prisma`. `sessions` só no schema; o módulo está em `wip/sessions`.
- **Branches remotas:** `origin/main` e `origin/wip/sessions` (`e7300a8`). Branch desta tarefa: `docs/pipeline-manual`.
- **Testes (rodados nesta sessão, na branch de docs):** typecheck sem erros; unitários 1/1; `lint:check` limpo; hooks 136/136. E2E **não rodados** (exigem Postgres): não verificado.
- **Docs:** `domain.md`, ADRs 0001 a 0008, `PIPELINE.md` (manual do kit) e `docs/plans/` (vazio, com `.gitkeep`).
## Divergências de `domain.md` (travadas por teste, sem correção)
- Routines: F4 faixas e `order` negativo, F11 `order` repetido, F10 sem limites, F6 `exerciseId` inexistente dá 500, caso 1 `name: null` dá 500.
- Exercises: E1/E2 exercício sem dono, E4 `muscleGroup` livre e `type` aceito. AuthGuard: C1 não consulta o usuário.
## Fila de código (cada uma com plano aprovado, nesta ordem)
1. Caso 1: `PUT /routine/:id` com `name: null` → 400.
2. F6: `exerciseId` inexistente → 400.
3. F4 e F11: faixas e `order` único.
4. C1: `AuthGuard` consulta o usuário (existe e está ativo).
5. Endurecer o CI (manter o nome do job `build-and-check`).
6. Migration que remove `type` (E4, risco alto).
7. `doc-warning` avisar quando o STATUS não for tocado (item da retro).
## Pendências do humano
- Mergear o PR de `docs/pipeline-manual`; apagar branches mergeadas, incluindo `docs/dominio-2`.
- `wip/sessions`: sem decisão (42 erros de lint e 2 suítes falhando, segundo `AGENTS.md`; não reverificado).
- `TODO(humano)`: duração-alvo (F4), LGPD, licença da mídia, tradução, teto de fichas arquivadas, `npm ci --omit=dev` em produção.
- Aprovar a dependência nova da ficha por IA (ADR 0007).
