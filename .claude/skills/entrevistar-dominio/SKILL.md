---
name: entrevistar-dominio
description: Use quando docs/domain.md tem regras `CONFIRMAR(humano)`, `TODO(humano)` ou "Decisões pendentes" e o humano quer fechá-las por entrevista guiada, uma pergunta por vez. Não use para implementar, para decidir no lugar do humano, nem para só gravar respostas que ele já deu (use registrar-decisoes).
---

# Entrevistar o domínio

Fecha as lacunas de `docs/domain.md` perguntando ao humano. O humano decide tudo; o agente pergunta, registra e aponta conflitos. Não altera código.

## Antes de começar
1. Leia `docs/domain.md`, `docs/architecture.md` e `docs/adr/`.
2. Liste tudo que está `CONFIRMAR(humano)`, `TODO(humano)` ou em "Decisões pendentes", com a **contagem por bloco**, e mostre ao humano.
3. Só então faça a primeira pergunta.

## Regras da entrevista
- **Uma pergunta por vez**, curta e sem jargão. Espere a resposta.
- Quando ajudar, ofereça **no máximo 2 opções**, cada uma com o custo (impacto em schema, validação ou contrato). **Não escolha pelo humano e não diga qual prefere.**
- Registre as respostas **com as palavras do humano**. O que você sugeriu e ele não confirmou fica `SUGESTÃO(IA, não confirmada)`.
- Se a resposta **contradiz** uma regra ou ADR existente, aponte o conflito **antes de gravar** e pergunte qual vale.
- Se faltar informação que você não tem (formato de dados, regras do treino dele), diga isso e marque `TODO(humano)`. Nunca invente.
- **"Ainda não sei" é resposta válida:** vira `TODO(humano)` ou decisão `ADIADO`, com o motivo.
- Ao **fim de cada bloco**, mostre o trecho gravado para o humano corrigir antes de seguir.

## No final
1. Atualize "Mudanças de código decorrentes" em `docs/domain.md`, com o risco (baixo/médio/alto) de cada item novo.
2. Crie ADR (`docs/adr/`, a partir de `0000-template.md`) para cada decisão estrutural.
3. Liste o que segue pendente e por quê.

## Nunca
- Implementar as mudanças decorrentes (isso vira plano).
- Marcar `CONFIRMADO` por silêncio, nem generalizar uma resposta para outras regras.
