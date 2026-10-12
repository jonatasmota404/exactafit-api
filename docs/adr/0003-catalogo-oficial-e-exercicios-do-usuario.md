# ADR 0003 — Catálogo oficial global e exercícios do usuário

- **Status:** aceito (implementação no V1; antes adiada, ver revisão abaixo)
- **Data:** 2026-10-12
- **Autor:** Jônatas Júnior

## Contexto
`Exercise` não tem dono. Qualquer usuário autenticado cria exercícios por `POST /exercises`, e `GET /exercises` devolve todos para todos (`src/exercises/`). Existe um dataset de exercícios que deve originar o catálogo. A forma de carregá-lo no banco foi decidida depois (ver [ADR 0005](0005-carga-do-dataset-de-exercicios.md)).

## Decisão
- O catálogo oficial é global e somente leitura, vindo do dataset.
- Um exercício criado por usuário pertence só a ele.
- `muscleGroup` segue uma lista fechada de 10 valores, os `body_part` do dataset. O campo `type` sai (ver [ADR 0006](0006-cardio-no-v1-e-remocao-do-type.md)).
- O usuário edita e remove os próprios exercícios; oficial e de outro usuário respondem 404; a remoção é recusada com séries registradas ou em ficha.
- A implementação entra no V1. **Revisão em 2026-10-12:** estava adiada ("uso pessoal por ora"); o humano decidiu multiusuário desde o V1 ("Sim, entra na V1"). Até ser implementada, o código atual permanece como está.

## Alternativas descartadas
- **Catálogo único, aberto à escrita de qualquer usuário (comportamento atual):** mistura exercícios de usuários com o catálogo oficial.
- **Outras alternativas e seus motivos:** `TODO(humano)`.

## Consequências
- **Positivas:** o catálogo oficial fica estável. Os exercícios de cada usuário não aparecem para os outros.
- **Negativas / custos:** quando for implementado, exige dono opcional em `Exercise` (migration), filtro nas consultas e bloqueio de escrita no catálogo oficial.
- **O que passa a ser obrigatório:** enquanto não for implementado, nenhuma tarefa deve presumir que exercícios têm dono.
- **Decidido depois:** o dataset entra por carga repetível, com o id do dataset em cada exercício oficial (ver [ADR 0005](0005-carga-do-dataset-de-exercicios.md)).
- **Em aberto (`TODO(humano)`):** tradução dos 10 valores de `muscleGroup` para o app.
- Regras: `docs/domain.md` E1, E2, E4, E5, E6.
