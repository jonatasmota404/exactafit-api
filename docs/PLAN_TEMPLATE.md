# Plano de risco: <título da tarefa>

> Só risco alto (risco baixo e médio não têm arquivo). Copie para `docs/plans/AAAA-MM-DD-<slug>.md`. Descartável: o essencial vai para a descrição do PR e este arquivo é removido (`git rm`) no mesmo PR.

Aprovado por: —
Revisão do plano: — <!-- "APROVADO em AAAA-MM-DD" do revisor-de-plano, ou "AJUSTAR aceito pelo humano: <pendências>" -->

## Critérios de aceite
<!-- Um por linha: comportamento observável (entrada → resultado), incluindo o caminho de erro, e o teste que o prova.
Nada de "funciona bem". Pergunta sem resposta fica no ponto exato como [DÚVIDA: …]. -->
- [ ] C1: <comportamento> — teste: <caso> em `<arquivo de teste>`

Fora de escopo: <!-- o que parece relacionado e não será feito -->

## Risco
- **Zona tocada:** <!-- lista no AGENTS.md -->
- **Como desfazer:** <!-- comando ou passos executáveis; migração de dados, se houver -->
- **Pré-mortem:** <!-- se der errado em produção, por quê? -->
- **Segurança:** <!-- skill seguranca: itens que se aplicam e como serão verificados; ou "não se aplica: <motivo>" -->
- **Dependências novas:** Nenhuma. <!-- Se houver: comando e saída da conferência no registro (AGENTS.md, regra 5). -->

## Validação do humano
<!-- O comando ou os passos para o humano rodar o comportamento depois do PR (requisição, tela, script) e o resultado esperado. -->
