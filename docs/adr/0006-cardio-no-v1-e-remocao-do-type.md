# ADR 0006 — Cardio no V1 e remoção do campo `type`

- **Status:** aceito (implementação ainda não planejada)
- **Data:** 2026-10-12
- **Autor:** Jônatas Júnior

## Contexto
O produto inclui cardio e exercícios em casa no V1. Hoje `Exercise.type` é texto livre com padrão `strength`, `SetLog` guarda só série, repetições e carga, e `RoutineItem` exige `targetReps` de 1 a 100. O dataset não tem campo equivalente a `type`; o cardio aparece só como `body_part = cardio` (29 exercícios).

## Decisão
- O campo `type` **sai** de `Exercise`. O cardio é decidido por `muscleGroup = cardio`.
- A série registra cardio só pelo **tempo** (duração em segundos, opcional); distância fica fora do V1.
- `SetLog.repsCompleted` e `SetLog.weightKg` passam a opcionais; carga vazia significa sem carga. A API não valida o que cada série precisa ter.
- `RoutineItem.targetReps` passa a opcional e o item ganha a duração-alvo em segundos (opcional); pelo menos um dos dois é obrigatório.

## Alternativas descartadas
- **Manter `type` com `strength` e `cardio`:** duas colunas podem discordar (`muscleGroup = chest` e `type = cardio`).
- **Cardio fora do V1:** descartado pelo humano; a ficha por IA e o cardio precisam se encontrar.
- **Tempo e distância no V1:** distância pode entrar depois como coluna opcional.
- **Validação cruzada por tipo de exercício:** descartada pelo humano; série vazia é aceita e os relatórios toleram.

## Consequências
- **Positivas:** uma única fonte para "é cardio"; sem lista inventada que o dataset não tem.
- **Negativas / custos:** a migration apaga a coluna `type` (zona de risco) e quem ainda enviar `type` no `POST /exercises` recebe 400; um exercício não pode ser cardio sem estar no grupo cardio; se houver mais tipos no futuro (mobilidade, alongamento), a coluna precisa voltar; relatórios precisam tolerar série sem repetições, sem carga e sem duração.
- **O que passa a ser obrigatório:** nenhum código pode ler `Exercise.type`.
- **Em aberto (`TODO(humano)`):** faixa da duração-alvo.
- Regras: `docs/domain.md` E4, F4, S5, S7.
