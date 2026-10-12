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
- As FKs de histórico passam de cascade para restrição: `SetLog.exerciseId`, `RoutineItem.exerciseId`, `WorkoutSession.routineId`, `SetLog.sessionId`, `WorkoutSession.userId` e `WorkoutRoutine.userId`. `RoutineItem.routineId` continua cascade.
- Um exercício que está em alguma ficha também não pode ser apagado (409).
- O usuário é desativado por padrão. O e-mail de um usuário desativado continua ocupado (cadastro com ele dá 409). **Exceção:** a pedido do titular, um fluxo explícito de exclusão de conta apaga todos os dados do usuário, inclusive os exercícios criados por ele (`Exercise.userId` em cascata). Numa transação, remove antes séries, sessões, itens e fichas, porque essas FKs são restrição.
- O `AuthGuard` passa a verificar se o usuário existe e está ativo e recusa com 401 o inexistente e o desativado. Hoje só verifica a assinatura do token, e um usuário desativado continuaria acessando por até 7 dias (token de 7 dias, U6).
- Série e sessão registradas são corrigidas, nunca apagadas. Motivo: com sincronização offline, apagar sessão exigiria um marcador de exclusão, e um aparelho antigo poderia ressuscitá-la.
- A ficha arquivada pode voltar a ser ativa e pode ser editada; `GET /routine` devolve só as ativas por padrão e a arquivada **não conta** no limite de 10 fichas ativas. **Revisão em 2026-10-12:** antes a arquivada contava (quem chegava a 10 nunca mais criava outra); o humano revisou. Fichas arquivadas não têm teto (`TODO(humano)`: se precisa de um).

## Alternativas descartadas
- **Manter o cascade (comportamento atual):** apaga histórico do usuário e de outros usuários.
- **Permitir apagar sessão registrada por engano** (era C4 na branch `docs/dominio-2`): descartado; com o offline exigiria marcador de exclusão e um aparelho antigo ressuscitaria a sessão. O erro se corrige editando a sessão.
- **Outras alternativas e seus motivos:** `TODO(humano)`.

## Consequências
- **Positivas:** o histórico de treino é preservado.
- **Negativas / custos:** migration para trocar as FKs e criar o campo de arquivamento. As consultas de fichas passam a considerar o arquivamento. A exclusão de conta é uma transação que depende da ordem de remoção; a ordem errada falha por violação de FK. O `AuthGuard` passa a fazer uma consulta ao banco por requisição e a tocar `src/auth/` (zona de risco), com plano próprio.
- **O que passa a ser obrigatório:** nenhuma exclusão de ficha pela API, só arquivamento (a única exceção é o fluxo de exclusão de conta). Toda FK nova que aponte para histórico não pode usar cascade; a exceção é `Exercise.userId` (dono do exercício, não histórico), que só dispara na exclusão de conta.
- **Em aberto (`TODO(humano)`):** o processo do pedido do titular (canal de contato e prazo), antes de haver usuários de terceiros.
- Regras: `docs/domain.md` E6, F9, F10, C1–C3, S9.
