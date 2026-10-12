# ADR 0003 — Catálogo oficial global e exercícios do usuário

- **Status:** aceito (implementação adiada)
- **Data:** 2026-10-12
- **Autor:** Jônatas Júnior

## Contexto
`Exercise` não tem dono. Qualquer usuário autenticado cria exercícios por `POST /exercises`, e `GET /exercises` devolve todos para todos (`src/exercises/`). Existe um dataset de exercícios que deve originar o catálogo. A forma de carregá-lo no banco está pendente (ver "Decisões pendentes" em `docs/architecture.md`).

## Decisão
- O catálogo oficial é global e somente leitura, vindo do dataset.
- Um exercício criado por usuário pertence só a ele.
- `muscleGroup` e `type` seguem uma lista fechada derivada do dataset (valores `TODO(humano)`).
- A implementação fica adiada (uso pessoal por ora). O código atual permanece como está.

## Alternativas descartadas
- **Catálogo único, aberto à escrita de qualquer usuário (comportamento atual):** mistura exercícios de usuários com o catálogo oficial.
- **Outras alternativas e seus motivos:** `TODO(humano)`.

## Consequências
- **Positivas:** o catálogo oficial fica estável. Os exercícios de cada usuário não aparecem para os outros.
- **Negativas / custos:** quando for implementado, exige dono opcional em `Exercise` (migration), filtro nas consultas e bloqueio de escrita no catálogo oficial.
- **O que passa a ser obrigatório:** enquanto não for implementado, nenhuma tarefa deve presumir que exercícios têm dono.
- **Em aberto (`TODO(humano)`):** como o dataset entra no banco (decisão pendente; a mídia é só para uso pessoal e não deve ser exposta pela API); edição e remoção de exercícios do usuário; valores das listas fechadas.
- Regras: `docs/domain.md` E1, E2, E4.
