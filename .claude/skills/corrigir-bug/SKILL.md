---
name: corrigir-bug
description: Use quando o humano relatar um bug (comportamento quebrado, erro, stack trace, "isso devia fazer X e faz Y") e pedir a correção. Caminho enxuto: reproduzir, teste que falha, causa raiz, menor correção, revisor e PR; para antes do merge. NÃO use para feature ou mudança de comportamento desejada (use planejar-tarefa), nem quando a correção toca zona de risco (dados, autenticação, migrations, dinheiro, contrato externo): aí vira plano.
---

# Corrigir bug

Leva um bug do relato ao PR sem o plano completo. Nunca mergeia.

## Passos
1. **Branch.** `git pull --ff-only` na `main` e branch `fix/<slug>`.
2. **É bug?** Ache o comportamento esperado escrito: `docs/domain.md`, ADR, teste existente, documentação.
   - Esperado não está escrito em lugar nenhum: é decisão de domínio. Pergunte ao humano; não presuma.
   - O pedido muda um comportamento que hoje está correto: não é bug. Pare e use `planejar-tarefa`.
3. **Reproduza.** Passos ou comando que mostram o sintoma, com a saída colada. Não reproduziu: pare e relate o que tentou.
4. **Teste que falha.** Escreva o menor teste que reproduz o bug, rode e mostre que falha pelo motivo do bug (não por erro de sintaxe, import ou ambiente). Commit só do teste (`test(escopo): ...`).
5. **Causa raiz.** `arquivo:linha` e por que acontece, em uma ou duas frases. Procure o mesmo defeito em outros lugares (`git grep` do padrão): corrigir só um de vários é o erro mais comum. Os que estão fora do escopo viram pendência no PR.
6. **Escala?** Pare e use `planejar-tarefa` se a correção:
   - toca zona de risco (lista no `AGENTS.md`);
   - exige mais de ~3 arquivos de produção ou ~100 linhas;
   - tem causa incerta depois da investigação;
   - pede dependência ou abstração nova.
7. **Menor correção** que faz o teste do passo 4 passar. Não altere, enfraqueça nem apague teste existente. Rode `.claude/verify.json` e cole as saídas.
8. **Revisão** pelo subagente `revisor`, em contexto limpo, com o diff e o registro do passo 9 no lugar do plano. O critério é: o teste do passo 4 passa e o sintoma do passo 3 sumiu. Vale o limite de 3 rodadas do `executar-tarefa`.
9. **Registro no corpo do PR** (template de `.github/pull_request_template.md`), em "O que mudou":
   - **Sintoma:** o que o usuário via.
   - **Reprodução:** passos ou comando.
   - **Causa:** `arquivo:linha` e o porquê.
   - **Correção:** o que mudou.
   - **Mesmo defeito em outros lugares:** corrigidos, ou "pendência: <onde>", ou "nenhum".
   Se o bug revelou regra de domínio que não estava escrita, atualize `docs/domain.md` ou declare "Sem impacto em doc: <motivo>". Uma linha em `docs/RETRO.md`.
10. **PR.** Commits coesos (`fix(escopo): ...`), push da branch, PR com o bloco "Aceite do humano" desmarcado, e acompanhe o CI. Entregue o link, o CI e os achados do revisor.

## Regras
- Nunca mergeie nem faça push na `main`.
- Sem teste que falhou antes da correção, não há correção: o teste é a prova.
- Não amplie o escopo: o que não é o bug vira pendência.
- Se qualquer comando for negado, pare e relate; nunca contorne.
