# ADR 0001 — Exclusão sem cascata de histórico

- **Status:** aceito
- **Data:** 2026-10-12
- **Autor:** Jônatas Júnior

## Contexto
Todas as FKs do schema usam `onDelete: Cascade`. Apagar um `Exercise` apaga os `RoutineItem` e os `SetLog` que o referenciam, de todos os usuários. Apagar uma `WorkoutRoutine` apaga as `WorkoutSession` e os `SetLog` dela. Hoje nenhuma rota apaga exercícios ou fichas, mas a regra já está no banco (`prisma/schema.prisma`).

## Decisão
- O histórico (sessões e séries) nunca é apagado em cascata.
- Um exercício com séries registradas não pode ser apagado.
- Uma ficha é arquivada, não apagada. Isso exige um campo de arquivamento em `WorkoutRoutine`.
- As FKs de histórico passam de cascade para restrição.

## Alternativas descartadas
- **Manter o cascade (comportamento atual):** apaga histórico do usuário e de outros usuários.
- **Outras alternativas e seus motivos:** `TODO(humano)`.

## Consequências
- **Positivas:** o histórico de treino é preservado.
- **Negativas / custos:** migration para trocar as FKs e criar o campo de arquivamento. As consultas de fichas passam a considerar o arquivamento.
- **O que passa a ser obrigatório:** nenhuma exclusão de ficha pela API, só arquivamento. Toda FK nova que aponte para histórico não pode usar cascade.
- **Em aberto (`TODO(humano)`):** se a regra vale para a exclusão de usuário; quais FKs exatas mudam (`SetLog.sessionId`, `RoutineItem.exerciseId`); se a ficha arquivada aparece nas listagens; o que acontece com um exercício usado só em fichas.
- Regras: `docs/domain.md` E6, F9, C1–C3.
