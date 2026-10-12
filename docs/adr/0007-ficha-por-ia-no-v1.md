# ADR 0007 — Ficha de treino por IA no V1

- **Status:** proposto (depende de aprovação de dependência e de definições do humano)
- **Data:** 2026-10-12
- **Autor:** Jônatas Júnior

## Contexto
O produto promete montar uma ficha padrão com IA, sem depender de avaliação com professor. Hoje a API não chama nenhum serviço externo e a ficha é montada à mão (`POST /routine`). A ficha tem limites (F4, F10: 10 fichas por usuário, arquivadas contam, e 50 itens por ficha) e só aceita exercício do catálogo oficial ou do próprio usuário (F6).

## Decisão
- A geração de ficha por IA **entra no V1**.
- A IA só monta a ficha com exercícios do catálogo (oficiais e do próprio usuário) e a ficha gerada passa pelas mesmas regras de F4, F6 e F10.
- A ficha gerada pertence ao usuário que a pediu (F1).

## Alternativas descartadas
- **Fora do V1, ficha só à mão:** descartado pelo humano.

## Consequências
- **Positivas:** o usuário sai do app com uma ficha sem passar por avaliação.
- **Negativas / custos:** serviço externo de IA (dependência nova, **exige aprovação explícita do humano**), chave de API, custo por uso e dados do usuário saindo da API. Como a ficha arquivada conta no limite de 10 e nada é apagado, gerar várias fichas ruins gasta o limite do usuário para sempre.
- **O que passa a ser obrigatório:** nenhuma ficha gerada pode fugir das regras de F4, F6 e F10.
- **Em aberto (`TODO(humano)`):** qual serviço de IA; o que o usuário informa para gerar a ficha (objetivo, nível, dias por semana); se regenerar substitui o rascunho ou cria outra ficha; aprovação da dependência.
- Regras: `docs/domain.md` Visão do produto, F4, F6, F10.
