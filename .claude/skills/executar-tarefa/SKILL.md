---
name: executar-tarefa
description: Use quando houver critérios de aceite aprovados pelo humano (risco médio, na conversa) ou um plano de risco aprovado em docs/plans/ (risco alto) e for hora de implementar. Conduz até o PR — testes dos critérios primeiro, implementador, verificação, revisor adversarial e testador em contexto limpo — e para antes do merge. NÃO use sem critérios aprovados (use planejar-tarefa) nem para risco baixo (o agente trabalha direto).
---

# Executar tarefa

Leva critérios aprovados até um PR pronto para o humano mergear. Nunca mergeia.

## Entrada
- **Médio:** os critérios aprovados na conversa (o humano disse "aprovado").
- **Alto:** `docs/plans/<arquivo>.md` com `Aprovado por: humano em <data>` e `Revisão do plano:` preenchida. Faltando qualquer um, **pare** e peça. Só grave `Aprovado por` depois que o humano aprovar no chat.
- Algum `[DÚVIDA:` nos critérios ou no plano (`grep -n '\[DÚVIDA:' <plano>`): **pare** e pergunte.

## Passos
1. **Branch e linha de base.** Branch nova da `main` atualizada (`git pull --ff-only`). Rode os `checks` de `.claude/verify.json`. Se algo falhar, confirme na `main` limpa e **pare**.
2. **Testes primeiro.** Um teste por critério, só os que os critérios pedem. Rode e cole a saída mostrando que falham pelo motivo certo (não por sintaxe, import ou ambiente). Commit só dos testes (`test(escopo): ...`). Teste que já passa antes do código não prova nada: pare e relate.
3. **Implementação** pelo subagente `implementador`, com os critérios e os testes. Os testes do passo 2 são fixos.
4. **Verificação.** `checks` de `.claude/verify.json` e, se tocou banco ou rotas, a integração da tabela "Comandos"; saídas coladas.
5. **Revisão** pelo subagente `revisor`, em contexto limpo e, quando possível, em modelo diferente do que implementou, com os critérios e as "Decisões e suposições" do implementador. Se a mudança tem tela, endpoint ou comando que alguém usa, chame também o subagente `testador` (pode ser em paralelo), com os critérios e o que o diff tocou. Corrija BLOQUEANTE e IMPORTANTE dentro do escopo; o resto vira pendência no PR. Sonda do revisor que quebrou a mudança e caso do testador que falhou viram teste na suíte.
   - Testador "não executado" porque falta "subir o app" no `AGENTS.md`: registre como pendência no PR; não invente o comando.
   - **Rodada** = corrigir as listas "Para aprovar" e "Para passar", repetir o passo 4 e pedir nova revisão (e novo teste, se o testador entrou). No máximo **3 rodadas**.
   - Na 3ª sem aprovação, **pare**: entregue ao humano o que falhou em cada rodada, a causa provável (critério, teste, ambiente ou código) e o que ele precisa decidir. Não abra o PR.
6. **Domínio.** Regra de negócio nova ou alterada: `docs/domain.md` no mesmo PR; decisão difícil de reverter: ADR.
7. **PR** com o template de `.github/pull_request_template.md`: critérios → testes, "Decisões e suposições do agente" e "O que os checks não provam" (copiadas da saída do implementador, ajustadas pelas rodadas de revisão), evidência (comandos e saídas, veredito do revisor e do testador), pendências, riscos. Risco alto: copie o passo "Validação do humano" do plano para o PR e depois `git rm` do plano (`chore(docs): remove plano concluído`). Declaração que só existia no plano (`Teste alterado: <motivo>`) vai para a mensagem de um commit. `git add` só dos arquivos da tarefa, push da branch, acompanhe o CI até terminar.
8. **Entrega:** link do PR, resultado do CI, veredito do revisor (e do testador, se entrou), as "Decisões e suposições do agente" e "O que os checks não provam" (ou "Nenhuma") e "pronto para você mergear" ou o que impede.

## Regras
- Nunca mergeie nem faça push na `main`.
- Nunca altere, enfraqueça, desative ou apague teste para fazê-lo passar.
- Não amplie o escopo além dos critérios.
- Decisão que toca regra de negócio não registrada em `docs/domain.md` não entra em "Decisões e suposições": não decida sozinho, pare e pergunte (regra 7 do `AGENTS.md`).
- Comando negado: pare e relate; nunca contorne. Falso positivo de comando composto: rode os comandos separados; se ainda for bloqueado, pare.
