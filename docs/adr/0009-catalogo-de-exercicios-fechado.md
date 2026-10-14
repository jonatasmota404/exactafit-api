# ADR 0009 — Catálogo de exercícios fechado

- **Status:** aceito (implementação ainda não planejada). Substitui o [ADR 0003](0003-catalogo-oficial-e-exercicios-do-usuario.md).
- **Data:** 2026-10-14
- **Autor:** Jônatas Júnior

## Contexto
O [ADR 0003](0003-catalogo-oficial-e-exercicios-do-usuario.md) decidiu, para o V1, um catálogo oficial global e somente leitura, mais exercícios criados pelo usuário, que pertenceriam só a ele (dono opcional em `Exercise`, edição e remoção dos próprios exercícios). Nada disso foi implementado. Hoje `Exercise` não tem dono (`prisma/schema.prisma:14-26`), qualquer usuário autenticado cria exercícios por `POST /exercises` e `GET /exercises` devolve todos para todos (`src/exercises/`). O catálogo oficial vem do dataset local, por carga repetível ([ADR 0005](0005-carga-do-dataset-de-exercicios.md)).

## Decisão
- O catálogo de exercícios é **fechado**: vem só do dataset oficial ([ADR 0005](0005-carga-do-dataset-de-exercicios.md)).
- Usuários não criam exercícios.
- A decisão anterior (catálogo oficial + exercícios do usuário no V1, ADR 0003) fica **revogada**.
- **Motivo da mudança** (palavras do humano): "O motivo é porque pode dar problema, é melhor ter uma base fixa de exercícios que o proprietário do sistema atualize e seja uma base comum para todos."
- Continua valendo do ADR 0003, porque não depende de haver exercício do usuário: `muscleGroup` com os 10 valores de `body_part` e saída do campo `type` ([ADR 0006](0006-cardio-no-v1-e-remocao-do-type.md)).

## Alternativas descartadas
- **Catálogo oficial + exercícios do usuário (ADR 0003):** revogada pelo motivo acima.
- **Catálogo único, aberto à escrita de qualquer usuário (comportamento atual):** já descartada no ADR 0003; continua descartada.
- **Outras alternativas e seus motivos:** `TODO(humano)`.

## Consequências
- **Positivas:** uma base comum de exercícios para todos os usuários, mantida pelo proprietário do sistema. `Exercise` não precisa de dono, então some a FK `Exercise.userId` planejada e o filtro por dono nas consultas de exercício.
- **Negativas / custos:** o usuário não registra exercício que não esteja no dataset. O comportamento atual de `POST /exercises` (qualquer usuário cria) passa a divergir da regra. Os testes de caracterização de exercícios precisam ser revistos quando a mudança for implementada.
- **O que passa a ser obrigatório:** nenhuma tarefa deve presumir que exercícios têm dono ou que usuários criam, editam ou removem exercícios.
- **Em aberto (perguntas ao dono, sem decisão):**
  - **P1:** o que acontece com `POST /exercises`: remover, ou restringir a quem carrega o dataset? `TODO(humano)`.
  - **P2:** como o dataset é atualizado depois do V1? `TODO(humano)`.
- Regras: `docs/domain.md` E1, E2, E6, F6, S8, C1, C3, invariantes 6 e 7, glossário.
