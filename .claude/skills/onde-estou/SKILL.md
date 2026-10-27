---
name: onde-estou
description: Use quando o humano quiser se situar no projeto ("onde estou?", "o que eu estava fazendo?", "qual o próximo passo?", "o que está pendente?"). Lê o estado ao vivo (git, PRs, planos, dúvidas e pendências) e responde onde ele está, o que está em andamento e o próximo passo com o comando exato. Só lê. Não use para explicar código (use explicar) nem para fazer a próxima tarefa.
---

# Onde estou

Só lê; não altera arquivos nem o git. Não lê o manual do humano (para isso há o modo `retomar` do `curador-do-manual`).

## Colete
1. **Git:** `git status -sb`, `git branch --show-current`, `git log -5 --oneline`, `git log --oneline main..HEAD` (commits da branch ainda fora da `main`).
2. **PRs:** `gh pr list --state open` e, para o PR da branch atual, `gh pr checks`. Sem `gh` disponível, marque "não verificado".
3. **Planos** em `docs/plans/`:
   - aguardando aprovação (`Aprovado por: —`);
   - com `[DÚVIDA:` (`grep -ln '\[DÚVIDA:' docs/plans/*.md`);
   - aprovados com "Resultado" vazio (em andamento ou abandonados);
   - o campo "Pendências" dos "Resultado" preenchidos.
4. **Domínio:** quantos `CONFIRMAR(humano)` e `TODO(humano)` há em `docs/domain.md`.

## Responda curto, nesta ordem
1. **Onde você está:** branch, se há mudança não commitada, quantos commits à frente da `main`.
2. **Em andamento:** o plano ou PR ligado a esta branch, e em que passo está (plano sem aprovação, executando, PR aberto com CI verde ou vermelho).
3. **Esperando você:** dúvidas abertas, plano para aprovar, PR para o "Aceite do humano" e merge, regras de domínio pendentes.
4. **Próximo passo:** UM, com o comando exato. Use o `docs/TUTORIAL.md` para o comando:
   - plano com `[DÚVIDA:` → responder as dúvidas;
   - plano sem aprovação → ler e aprovar;
   - plano aprovado sem "Resultado" → `use a skill executar-tarefa com o plano docs/plans/<arquivo>.md`;
   - PR aberto com CI verde → "Aceite do humano" e merge pelo GitHub;
   - PR com CI vermelho → ver a falha (`gh pr checks`);
   - nada em andamento → `git switch main && git pull --ff-only` e `use a skill planejar-tarefa: <próxima tarefa>`.

Fato sem comando executado é "não verificado". Não invente pendência.
