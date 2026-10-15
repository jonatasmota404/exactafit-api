---
name: planejar-tarefa
description: Use antes de implementar qualquer tarefa não trivial (feature, correção que toca mais de um arquivo, mudança de schema ou de zona de risco), ou quando pedirem um plano. Gera um plano em docs/plans/ a partir de docs/PLAN_TEMPLATE.md para o humano aprovar. NÃO implementa.
---

# Planejar tarefa

Produz só o plano. Não altere código, schema nem configuração.

## Passos
1. Leia `AGENTS.md`, `docs/domain.md`, `docs/adr/` e o código que a tarefa toca.
2. Faça a **entrevista por tarefa** (abaixo) e passe pelas skills `menor-esforco` e, quando couber, `seguranca`.
3. Copie `docs/PLAN_TEMPLATE.md` para `docs/plans/AAAA-MM-DD-<slug>.md` e preencha:
   - **Intenção:** 1–3 frases.
   - **Critérios de aceite:** comportamento observável e testável (rota, status, dado gravado), não "funciona bem".
   - **Testes:** uma linha por critério que muda comportamento: critério, caso (entrada → esperado) e arquivo de teste. Inclua o caminho de erro. Só o que o critério pede; sem teste de caso impossível nem de detalhe interno. Se a tarefa não muda comportamento (documentação, configuração, refatoração já coberta por testes), escreva `Sem teste novo: <motivo>`. Em risco médio ou alto, peça ao humano que aprove esta lista junto com o plano.
   - **Risco:** nível, zona de risco tocada, o que pode quebrar.
   - **Menor esforço:** a linha da skill `menor-esforco`.
   - **Segurança:** só em risco médio ou alto que toque autenticação, dados pessoais, entrada externa, segredos ou dependências (skill `seguranca`).
   - **Tarefas:** pequenas, um commit cada.
   - **Arquivos a tocar:** lista fechada, incluindo os arquivos de teste. Qualquer arquivo fora dela durante a implementação é suspeito.
   - **Abstrações novas:** padrão **nenhuma**. Só com dois usos reais já existentes, citados.
   - **Dependências novas:** padrão `Nenhuma`. Se precisar, preencha a tabela da seção (existe no registro, primeira/última publicação, mantenedor, por que não dá para evitar), com o comando e a saída da consulta, e só então peça aprovação explícita.
   - **Como verificar:** comandos do projeto e passos manuais que provam cada critério.
   - **Fora de escopo:** o que parece relacionado e não será feito.
4. Liste **perguntas para o humano** no fim do plano. Regra de negócio que não está em `docs/domain.md` vira pergunta, não suposição.

## Entrevista por tarefa (antes do plano)
Investigue primeiro (código, comandos, histórico do git) e pergunte para **confirmar**, não para o humano explicar do zero. Uma pergunta por vez, no máximo 2 opções com o custo de cada; grave com as palavras do humano e marque `SUGESTÃO(IA, não confirmada)` o que não foi confirmado. "Ainda não sei" é resposta válida (vira TODO ou decisão adiada com gatilho de revisão).

Só pergunte o que **muda o que será construído**. Decisão barata de reverter: decida por padrão e registre no plano, sem pergunta. Difícil de reverter (dados, contrato externo, autenticação, plataforma): pergunte e vire ADR. Categoria que não se aplica: declare "não se aplica agora: <motivo>".

| Risco | Perguntas |
|---|---|
| Baixo | 0 se não houver ambiguidade; no máximo 3 |
| Médio | até 8: regras de domínio envolvidas, casos de borda, modos de falha, como será provado, impacto em docs e em quem consome |
| Alto | as de médio, mais: reversibilidade e plano de desfazer, migração de dados, segurança e privacidade, concorrência e desempenho, observabilidade, pelo menos 2 alternativas com trade-offs, raio de impacto e **pré-mortem** ("se isso der errado em produção, por quê?"); ADR se difícil de reverter |

- **Domínio** (regra, o que o produto deve fazer, números de limite): só o humano. Nunca presuma nem sugira número sem base.
- **Técnica**: recomende UMA opção, com 2 alternativas, trade-offs, reversibilidade e custo de mudar depois; confira contra `docs/domain.md`, ADRs e `AGENTS.md` e aponte conflito.
- Pare de perguntar quando o plano deixar de mudar com a resposta.

## Critérios
- Menor mudança que resolve o pedido.
- Se o plano passar de ~300 linhas de diff estimado, divida em mais de um plano.
- Se a tarefa pede decisão estrutural, sugira um ADR; não decida sozinho.
- Pare depois de escrever o plano e peça aprovação.
