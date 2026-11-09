---
name: planejar-tarefa
description: Use antes de implementar tarefa de risco médio (regra de negócio nova ou alterada) ou alto (dinheiro, dados, autenticação, migrations, contrato externo; zona de risco, inclusive bug que toca zona de risco), ou quando pedirem um plano. Transforma a intenção numa lista curta de critérios de aceite verificáveis, cada um com o teste que o prova, para o humano aprovar; em risco alto, também o plano de risco em docs/plans/. NÃO use em risco baixo nem em bug fora de zona de risco (use corrigir-bug). NÃO implementa.
---

# Planejar tarefa

Produz critérios de aceite executáveis, não código. O humano aprova o "o quê"; o "como" fica com o agente.

## Passos
1. Leia `AGENTS.md`, `docs/domain.md`, `docs/adr/` e o código que a tarefa toca. Investigue antes de perguntar.
2. Pergunte só o que muda o que será construído, uma pergunta por vez, com a opção recomendada primeiro e uma frase do porquê importa. Domínio (regra, o que o produto faz, números de limite) é do humano: nunca presuma nem sugira número sem base. Técnica: recomende uma opção e siga. Pare de perguntar quando a resposta deixar de mudar os critérios.
3. Escreva os critérios, um por linha:
   `- [ ] C1: <comportamento observável, entrada → resultado> — teste: <caso> em <arquivo de teste>`
   - inclua o caminho de erro;
   - nada de adjetivo sem número ("rápido", "robusto", "seguro");
   - só o teste que o critério pede (sem caso impossível nem detalhe interno);
   - uma linha "Fora de escopo".
   Pergunta sem resposta fica no ponto exato como `[DÚVIDA: …]`. Com marcador, não há aprovação.
4. **Médio:** mostre os critérios na conversa e peça "aprovado". Sem arquivo. Os critérios aprovados vão para a descrição do PR.
5. **Alto:** copie `docs/PLAN_TEMPLATE.md` para `docs/plans/AAAA-MM-DD-<slug>.md` com os critérios e o bloco "Risco" (skill `seguranca` se tocar autenticação, dados pessoais, entrada externa, segredos ou dependências) e o passo de "Validação do humano". Chame o subagente `revisor-de-plano` em contexto limpo; se AJUSTAR, aplique e chame mais uma vez; se persistir, leve as pendências ao humano. Preencha `Revisão do plano:` e peça a aprovação.
6. Pare. Aprovado, o próximo passo é `use a skill executar-tarefa`.

## Critérios
- Mais de ~300 linhas de produção estimadas: divida em mais de uma tarefa.
- Decisão difícil de reverter (dados, contrato externo, autenticação, plataforma): proponha um ADR; não decida sozinho.
- Abstração ou dependência nova: regras 2 e 5 do `AGENTS.md`.
