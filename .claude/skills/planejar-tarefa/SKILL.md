---
name: planejar-tarefa
description: Use antes de implementar qualquer tarefa não trivial (feature, correção que toca mais de um arquivo, mudança de schema ou de zona de risco), ou quando pedirem um plano. Gera um plano em docs/plans/ a partir de docs/PLAN_TEMPLATE.md para o humano aprovar. NÃO implementa.
---

# Planejar tarefa

Produz só o plano. Não altere código, schema nem configuração.

## Passos
1. Leia `AGENTS.md`, `docs/domain.md`, `docs/architecture.md` e o código que a tarefa toca.
2. Copie `docs/PLAN_TEMPLATE.md` para `docs/plans/AAAA-MM-DD-<slug>.md` e preencha:
   - **Intenção:** 1–3 frases.
   - **Critérios de aceite:** comportamento observável e testável (rota, status, dado gravado), não "funciona bem".
   - **Risco:** nível, zona de risco tocada, o que pode quebrar.
   - **Tarefas:** pequenas, um commit cada.
   - **Arquivos a tocar:** lista fechada. Qualquer arquivo fora dela durante a implementação é suspeito.
   - **Abstrações novas:** padrão **nenhuma**. Só com dois usos reais já existentes, citados.
   - **Dependências novas:** padrão nenhuma. Se precisar, peça aprovação explícita.
   - **Como verificar:** comandos do projeto e passos manuais que provam cada critério.
   - **Fora de escopo:** o que parece relacionado e não será feito.
3. Liste **perguntas para o humano** no fim do plano. Regra de negócio que não está em `docs/domain.md` vira pergunta, não suposição.

## Critérios
- Menor mudança que resolve o pedido.
- Se o plano passar de ~300 linhas de diff estimado, divida em mais de um plano.
- Se a tarefa pede decisão estrutural, sugira um ADR; não decida sozinho.
- Pare depois de escrever o plano e peça aprovação.
