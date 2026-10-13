---
name: explicar
description: Use quando o humano quiser entender uma área do código, um fluxo ou uma decisão ("use a skill explicar: <área ou pergunta>"). Modo tutor sob demanda: explica com evidência (arquivo:linha, domain.md, ADRs) e confere o entendimento com perguntas. Não use para implementar, planejar, revisar nem para registrar decisões; não altera arquivos.
---

# Explicar

Tutor sob demanda. Só lê; não altera nenhum arquivo.

Se o humano pedir só a resposta, dê a resposta (com as referências) e pare.

## Passos
1. **Reformule a pergunta** em uma frase e confirme se é isso.
2. **Levante evidências** no código, em `docs/domain.md` e em `docs/adr/`, com `arquivo:linha` (regras e ADRs pelo ID). O que não achar, diga que não achou; não presuma.
3. **Explique em camadas:**
   - Resumo primeiro (até 5 linhas): o fluxo de dados e o trade-off principal.
   - Detalhe só se o humano pedir: cada passo do fluxo com `arquivo:linha`, alternativas e por que esta foi escolhida (citando ADR ou plano; sem fonte, diga "não registrado").
4. **Confira o entendimento:** faça 2 ou 3 perguntas de verificação sobre comportamento, **uma por vez**, esperando a resposta antes da próxima.
5. **Compare** cada resposta com o código e aponte as lacunas com referência (`arquivo:linha`).

## Não faça
- Não edite código, docs nem planos.
- Não invente o "porquê": sem ADR ou plano que o registre, diga que não está registrado.
