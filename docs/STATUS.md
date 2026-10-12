# Status do projeto
> Atualizado em 2026-10-12, conferido na `main` (`83a30e5`). O agente atualiza ao fim de cada tarefa (máx. 30 linhas).
## Estado atual
- **Main protegida:** PR obrigatório, `enforce_admins` e check `build-and-check` obrigatório. PRs #1 a #15 mergeados, nenhum aberto.
- **Código:** `auth`, `exercises`, `routines`, `prisma`. `sessions` só no schema; o módulo está em `wip/sessions` (só local).
- **Testes na `main`:** unitários 1, hooks 136, e2e 72 passando e 3 `todo`, incluindo a caracterização de `AuthGuard`, `exercises` e `routines`.
- **Docs:** `domain.md` e ADRs 0001 a 0008 (`docs/dominio-3`). A `docs/dominio-2` não deve ser mergeada.
## Divergências de `domain.md` (travadas por teste, sem correção)
- F4 faixas e `order` negativo, F11 `order` repetido, F10 sem limites, F6 `exerciseId` inexistente dá 500, caso 1 `name: null` dá 500.
- E1/E2 exercício sem dono, E4 `muscleGroup` livre e `type` aceito, C1 o `AuthGuard` não consulta o usuário.
## Últimas 5 tarefas
- Caracterização de `routines`: PR #15. Caracterização de `exercises`: PR #14.
- Caracterização do `AuthGuard`: PR #13.
- Decisões de domínio e ADRs 0004 a 0008: PR #12.
- Ritual diário, worktree e teto de diff de produção: PR #11.
## Fila de código (cada uma com plano aprovado)
1. Caso 1: `PUT /routine/:id` com `name: null` → 400.
2. F6: `exerciseId` inexistente → 400.
3. F4 e F11: faixas e `order` único.
4. C1: `AuthGuard` consulta o usuário (existe e está ativo).
5. E4: migration que remove `type`.
## Pendências do humano
- Apagar branches mergeadas, incluindo `docs/dominio-2`.
- `TODO(humano)`: duração-alvo (F4), LGPD, licença da mídia, tradução, teto de fichas arquivadas, `npm ci --omit=dev` em produção.
- Aprovar a dependência nova da ficha por IA (ADR 0007).
- Decidir o destino de `wip/sessions` (42 erros de lint e 2 suítes falhando, segundo `AGENTS.md`; não reverificado).
