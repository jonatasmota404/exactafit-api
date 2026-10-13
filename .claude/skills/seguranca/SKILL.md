---
name: seguranca
description: Use ao planejar ou revisar trabalho de risco médio ou alto que toque autenticação, dados pessoais, entrada externa, segredos ou dependências, para decidir quais controles de segurança se aplicam e como serão verificados. Não use em risco baixo, nem como substituto do aceite humano ou das verificações automáticas do CI.
---

# Segurança

Guia de perguntas para o plano e para a revisão. Detalhe por tipo de trabalho em `checklist.md` (leia só a parte que se aplica).

## Escalada
- **Risco baixo:** não passa por esta skill.
- **Médio ou alto, tocando** autenticação, dados pessoais, entrada externa, segredos ou dependências: o plano ganha a seção **"Segurança"** com:
  - quais itens do checklist se aplicam e quais não (cada "não se aplica agora" com o motivo);
  - como cada item aplicável será verificado (teste, comando, revisão humana).
- **Alto:** acrescente um **modelo de ameaças curto** (ativos; quem ataca; o que pode dar errado; mitigação) e um **ADR** se a decisão for difícil de reverter (autenticação, plataforma, contrato externo, dados).

## Como investigar
1. Identifique o tipo de trabalho (API, aplicação web, mobile, funcionalidade com LLM) e abra a seção correspondente do `checklist.md`.
2. **Investigue primeiro, pergunte para confirmar:** levante no código e no histórico onde o controle existe ou falta, com evidência, e só então pergunte ao humano.
3. Decisão de domínio (quem pode ver o quê, o que é dado sensível, limites de uso) é do humano: pergunte; não presuma.

## Princípios
- **Controle simples e padrão antes de mecanismo próprio** (skill `menor-esforco`): biblioteca madura e já instalada antes de código de criptografia, sessão ou autorização feito à mão.
- Item que não se aplica é **declarado**, não omitido.
- Revisão de segurança por IA tem pontos cegos e **não substitui o aceite humano** em autenticação, dados e segredos.
- A camada robusta são as **verificações objetivas no CI do projeto** (varredura de segredos, auditoria de dependências, análise estática). Esta skill só as recomenda; não crie workflow de CI do projeto dentro de uma tarefa de feature.

## Nunca
- Declarar "seguro" sem evidência; sem execução ou leitura, "não verificado".
- Imprimir ou ler `.env` e segredos.
