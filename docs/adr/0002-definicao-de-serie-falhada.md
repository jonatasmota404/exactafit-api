# ADR 0002 — Definição de série falhada

- **Status:** aceito
- **Data:** 2026-10-12
- **Autor:** Jônatas Júnior

## Contexto
`SetLog` tem o campo `failed` (boolean, padrão `false`), mas o código não define o que ele significa e nenhuma rota o usa. Os valores planejados (`targetReps`) ficam em `RoutineItem`. `SetLog` não referencia `RoutineItem`: guarda só `sessionId` e `exerciseId`. Os itens da ficha ganham ids novos a cada substituição (`docs/domain.md` F8).

## Decisão
Série falhada (`failed = true`) é a série em que não completei as repetições planejadas.

## Alternativas descartadas
- `TODO(humano)`.

## Consequências
- **Positivas:** o campo passa a ter um significado único para relatórios e progressão.
- **Negativas / custos:** "repetições planejadas" ficam no item da ficha, que `SetLog` não referencia, e os itens podem ser substituídos depois da sessão. Se `failed` for calculado, o valor planejado precisa estar disponível no momento do registro.
- **O que passa a ser obrigatório:** nenhum código pode usar `failed` com outro significado (por exemplo, falha muscular).
- **Em aberto (`TODO(humano)`):** se `failed` é informado pelo usuário ou calculado (`repsCompleted` < repetições planejadas).
- Regra: `docs/domain.md` S6.
