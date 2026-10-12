# Status do projeto

> O agente atualiza este arquivo ao fim de cada tarefa (máx. 30 linhas). Estado de 2026-10-12, conferido em `main` (`834b20c`).

## Estado atual
- **Na `main`:** API NestJS com `auth`, `exercises`, `routines` e `prisma`; CI com `npm run typecheck`; pipeline de IA (hooks, subagentes, skills, `docs/RETRO.md`); `docs/architecture.md` e a primeira versão de `docs/domain.md` e dos ADRs 0001–0003.
- **Só no schema:** `WorkoutSession` e `SetLog` existem em migration, sem código. O módulo `sessions` está em `wip/sessions` (só local).
- **Fora da `main`, em branches:** `docs/dominio-2` (1 commit), `docs/dominio-3` (3 commits, regras do V1 e ADRs 0004–0007), `pipeline/guard-main` (1), `pipeline/retro-2` (1). Nenhum PR aberto para elas.
- **Dívida:** `wip/sessions` com 42 erros de lint e 2 suítes falhando (ver `AGENTS.md`).

## Últimas 5 tarefas
| Tarefa | Registro | Plano |
|---|---|---|
| Skill `entrevistar-dominio` e correções do RETRO | `09d2849` | sem plano (anterior a `docs/plans/`) |
| Regras da retro e `docs/RETRO.md` | `e6e1911` | sem plano |
| `dotenv` como dependência direta | PR #5 (`d5c6e56`) | sem plano |
| Decisões de domínio e ADRs 0001–0003 | PR #4 (`7a9b014`) | sem plano |
| CI usa `npm run typecheck` | PR #3 (`a0398f3`) | sem plano |

## Próximos passos
- Humano decidir o destino das branches `docs/dominio-2`, `docs/dominio-3`, `pipeline/guard-main` e `pipeline/retro-2` (a `docs/dominio-3` substitui a `docs/dominio-2`; ver `docs/RETRO.md`).
- Implementar as "Mudanças de código decorrentes" de `docs/domain.md` (da `docs/dominio-3`), cada uma com plano aprovado.
- Resolver a dívida de `wip/sessions` antes de ela voltar para a `main`.

## Pendências do humano
- Itens `TODO(humano)` e `CONFIRMAR(humano)` de `docs/domain.md` (a `main` tem 42 linhas com a marca; a `docs/dominio-3` fecha parte delas).
- Aprovação de dependência nova para a ficha por IA (ADR 0007, em `docs/dominio-3`).
- Reconferir a licença da mídia do dataset antes de uso comercial (ADR 0005, em `docs/dominio-3`).
