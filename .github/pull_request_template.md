## Resumo
<!-- 1–3 linhas: o que muda no comportamento e por quê. -->
Risco: <!-- baixo | médio | alto (tabela "Risco" do AGENTS.md) -->

## Critérios de aceite → testes
<!-- Um por linha: "C1: <comportamento> — <arquivo de teste>". Médio e alto: os critérios que o humano aprovou.
Sem comportamento novo: "Sem teste novo: <motivo>". -->

## Decisões e suposições do agente
<!-- Só o que afeta comportamento ou regra de negócio e o agente decidiu sem perguntar: default escolhido,
requisito reinterpretado quando dois conflitam, o que ficou de fora por interpretação.
No máximo 5, um por linha: "<decisão> → <alternativa descartada>". Sem decisão: "Nenhuma".
Não liste detalhe de implementação nem estilo. -->

## Evidência
<!-- Comandos rodados e resultado (checks de .claude/verify.json, integração se houver);
commit dos testes que falharam antes do código; veredito do revisor e sondas que ele rodou;
veredito do testador e os casos que ele usou no sistema rodando, se a mudança tem tela, endpoint ou comando. -->
O que os checks não provam: <!-- comportamento, caso ou ambiente que nenhum check verde cobre; ou "não sei dizer: pedir revisão humana". -->

## Pendências
<!-- O que ficou de fora, achados do revisor não corrigidos, decisões do humano. "Nenhuma", se for o caso. -->

## Riscos e como reverter
<!-- Zona de risco tocada, o que pode quebrar, como desfazer. Domínio: regra nova em docs/domain.md ou ADR. -->

## Validação do humano (só risco alto)
<!-- O comando ou os passos para rodar o comportamento e o resultado esperado. Só o humano marca. -->
- [ ] Rodei o comportamento e ele faz o que os critérios pedem.
