# ADR 0011 — App genérico de treino e dieta: o plano é dado

- **Status:** aceito (implementação por fases, ver [`produto.md`](../produto.md)). Substitui o [ADR 0005](0005-carga-do-dataset-de-exercicios.md), o [ADR 0007](0007-ficha-por-ia-no-v1.md) e o [ADR 0009](0009-catalogo-de-exercicios-fechado.md).
- **Data:** 2026-11-09
- **Autor:** Jônatas Júnior

## Contexto
O escopo anterior era uma API só de treino: ficha por IA no V1, catálogo fechado com os 1.324 exercícios do dataset e mídia, alimentação fora do V1, visão futura de venda para academias com papel de professor. O humano consolidou outro produto em [`produto.md`](../produto.md): um app de uso individual ou em família, que representa qualquer dieta e qualquer programa de treino definidos pelo usuário, de uma pessoa comum a um fisiculturista. Dois planos reais (perfis A e B, em PDF) servem só de modelo.

## Decisão
- **O plano é dado, não código.** Dieta e treino são estruturas configuráveis (refeições, metas, componentes, ciclo do programa, tipos de série, progressão). Nenhum número, quantidade de refeições ou regra de ajuste dos perfis A e B fica fixo no código; os PDFs entram como modelos (`PlanTemplate`) que o usuário usa, copia e edita.
- **Teste de generalidade:** a mesma engine representa o perfil A, o perfil B e um terceiro plano sem relação (push/pull/legs em 6 dias com superséries, 5 refeições e superávit) sem mudar código.
- **Alimentação entra no escopo**; household (família) é opcional e toda feature funciona sem ele.
- **Exercício próprio e privado do usuário** volta a existir, ao lado de um catálogo inicial curado. O dataset completo (1.324 exercícios) e a mídia ficam fora.
- **Sem IA em tempo de execução.** O assistente de criação usa fórmulas determinísticas; IA só para escrever conteúdo que um humano revisa. A ficha por IA sai.
- **Regras de revisão** são tipos parametrizados (variação de ritmo, estagnação, piso e teto), sem linguagem de regras livre. Sugestões automáticas sempre pedem aceite do usuário e nunca cruzam o piso.
- **Fora:** papéis de professor e academia, venda para terceiros, treino em casa e perfis de equipamento, ajuste automático por ciclo.

## Consequências
- `WorkoutRoutine` e `RoutineItem` serão absorvidos por `Program` e `WorkoutItem` (migration de risco alto, com plano próprio). **Alterado pelo [ADR 0014](0014-ficha-vira-treino.md):** são renomeados para `Workout` e `WorkoutItem`; o `Program` só organiza os treinos.
- `Exercise` ganha dono opcional; `POST /exercises` passa a criar exercício privado do usuário.
- Muitas tabelas novas (dieta, acompanhamento, household, sugestões); dados de saúde exigem isolamento por usuário aplicado na API.
- Regras de ajuste de calorias são recomendações de saúde: código determinístico, versionado e testado regra por regra, com avisos fixos.

## Alternativas consideradas
- Codificar os perfis A e B direto no código: mais rápido, mas quebra no terceiro plano e prende o app a duas pessoas.
- Manter o escopo anterior (só treino, catálogo fechado, ficha por IA): descartado pelo humano em 2026-11-09.
