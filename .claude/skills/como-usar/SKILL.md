---
name: como-usar
description: Use quando o humano perguntar como usar o kit ou o fluxo deste projeto ("como funciona?", "como faço X?", "qual comando para Y?", "o que é esse marcador?", "por que foi bloqueado?"). Responde a partir de docs/TUTORIAL.md, docs/DAILY.md, docs/PIPELINE.md e AGENTS.md, com o comando exato e onde está escrito. Não use para explicar o código do produto (use explicar) nem para executar a tarefa.
---

# Como usar

Só lê; não altera arquivos.

1. Leia `docs/TUTORIAL.md`. Se a resposta estiver lá, mostre a linha ou a seção da tabela que responde, com o comando exato para copiar.
2. Não está no tutorial: procure em `docs/DAILY.md`, `docs/PIPELINE.md`, `AGENTS.md` e no `description` das skills em `.claude/skills/`.
3. Responda curto, nesta ordem:
   - o que fazer (o comando ou o passo);
   - onde está escrito (`arquivo` e seção);
   - o próximo passo depois desse, quando houver.
4. Pergunta ampla ("como funciona o kit?"): mostre as seções 2 e 3 do tutorial e ofereça as outras pelo título.
5. Não achou em nenhum desses arquivos: diga "não está documentado no kit" e não invente comando, flag ou skill. Se a resposta for útil para outras vezes, sugira acrescentar uma linha ao `docs/TUTORIAL.md`.
