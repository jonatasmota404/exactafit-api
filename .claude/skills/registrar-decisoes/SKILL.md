---
name: registrar-decisoes
description: Use quando o humano responder perguntas de domínio ou tomar decisões (regra de negócio, exclusão, limites, arquitetura) e for preciso gravá-las em docs/domain.md e em ADRs. Não use para decidir no lugar do humano nem para implementar as mudanças.
---

# Registrar decisões

Grava o que o humano decidiu, com as palavras dele. Não altera código.

## Classificação
- `CONFIRMADO`: o humano validou o comportamento atual do código.
- `DECIDIDO (muda o código)`: o humano quer algo diferente do que o código faz.
- `ADIADO`: o humano adiou explicitamente.
- O que ele não respondeu continua `CONFIRMAR(humano)`.

## Passos
1. Para cada resposta, ache a regra correspondente em `docs/domain.md` (ou crie a linha) e atualize o texto e o status. Use **exatamente as palavras do humano**; ajuste só a gramática.
2. Decisão estrutural ou com alternativas descartadas → ADR em `docs/adr/` a partir de `0000-template.md`, numeração seguinte. Contexto e alternativas só com o que foi dito; o resto fica `TODO(humano)`.
3. Atualize "Mudanças de código decorrentes" em `docs/domain.md`: uma linha por mudança, com regra de origem, arquivos prováveis e risco (baixo/médio/alto; zona de risco?).
4. Remova ou atualize as perguntas respondidas onde estiverem (ex.: `docs/architecture.md`).
5. No fim, liste o que ficou ambíguo ou sem resposta.

## Nunca
- Completar o que o humano não disse, inferir o motivo ou generalizar uma resposta para outras regras.
- Marcar `CONFIRMADO` por silêncio.
- Implementar as mudanças decorrentes: isso vira plano (`planejar-tarefa`).
