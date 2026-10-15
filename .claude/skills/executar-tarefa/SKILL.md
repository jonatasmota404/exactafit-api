---
name: executar-tarefa
description: Use quando houver um plano aprovado em docs/plans/ e o humano pedir para implementá-lo ("use a skill executar-tarefa com o plano docs/plans/<arquivo>.md"). Conduz a tarefa do plano ao PR — testes primeiro, implementador, verificação, revisor, docs, métricas — e para antes do merge. NÃO use sem plano aprovado (use planejar-tarefa), para tarefa só de documentação trivial, nem para risco alto sem plano.
---

# Executar tarefa

Leva um plano aprovado até um PR pronto para o humano mergear. Nunca mergeia.

## Entrada
- Caminho do plano: `docs/plans/<arquivo>.md`.
- O plano precisa ter a linha `Aprovado por: humano em <data>`. Se não tiver (ou estiver `Aprovado por: —`), **pare** e peça aprovação explícita no chat. Só grave essa linha (com a data de hoje) depois que o humano aprovar.

## Passos
0. **Modelo.** Informe o modelo da sessão e o recomendado pelo plano; se o plano não indicar, use como referência o `model` do frontmatter dos agentes em `.claude/agents/`. Se divergirem, pare e peça ao humano para trocar com `/model`. Nunca siga com o modelo errado nem sugira exceção.
1. **Branch e linha de base.**
   - `git fetch --all --prune`.
   - Branch da tarefa: a que o plano indica. Uma tarefa, uma branch, um PR, com plano, código e docs juntos.
   - Linha de base: rode as verificações de `.claude/verify.json` e os testes de integração do módulo conforme a tabela "Comandos" do `AGENTS.md`.
   - Se algo falhar, confirme na `main` limpa antes de classificar como pré-existente e **pare**.
2. **Testes primeiro** (toda tarefa que muda comportamento; o plano declara `Sem teste novo: <motivo>` quando não muda).
   - Escreva os testes da seção "Testes" do plano, só eles.
   - Rode e mostre (saída colada) que falham pelo motivo certo, não por erro de sintaxe, import ou ambiente.
   - Commit só dos testes (`test(escopo): ...`), antes de qualquer código de produção.
   - Teste que já passa antes da implementação não prova nada: pare e relate.
3. **Implementação** pelo subagente `implementador`, só nos arquivos da lista "Arquivos a tocar" do plano. Arquivo fora da lista: pare e pergunte. Os testes do passo 2 são fixos: o implementador não os altera, enfraquece, desativa nem apaga. Se um teste estiver errado, ele para e relata; quem decide é o humano.
4. **Verificação completa**: `.claude/verify.json` e integração do módulo, com as saídas coladas.
5. **Revisão** pelo subagente `revisor`, em contexto limpo, com o diff e o plano. Ele confere também cobertura dos critérios, ordem dos testes e testes enfraquecidos. Corrija só o BLOQUEANTE ou IMPORTANTE dentro do escopo; o resto vira pendência no "Resultado".
6. **Documentação** conforme o plano e a definição de pronto do `AGENTS.md`. "Sem impacto em doc: <motivo>" só se o plano declarar.
7. **Registro.**
   - Preencha a seção "Resultado" do plano, incluindo o bloco "Para o manual": é o repasse ao curador do manual.
   - Uma linha em `docs/RETRO.md` se houve erro ou surpresa.
8. **Métricas.** Tabela no "Resultado":

   | Etapa | Modelo | Retrabalho | Erro pego por | Tempo |
   |---|---|---|---|---|
   | Plano | | | | |
   | Testes | | | | |
   | Implementação | | | | |
   | Revisão | | | | |

   Modelo de cada subagente: leia o frontmatter em `.claude/agents/`. "Erro pego por": hook, teste, revisor ou humano. Sem dado, escreva "não medido"; nunca estime.
9. **PR.** Commits coesos (Conventional Commits, `git add` só dos arquivos da tarefa), push da branch da tarefa, PR com o template de `.github/pull_request_template.md`, e acompanhe o CI do PR até terminar.
10. **Entrega**: link do PR, resultado do CI, achados do revisor, métricas e "pronto para você mergear" ou o que impede.

## Regras
- Nunca mergeie nem faça push na `main`.
- Nunca altere, enfraqueça, desative ou apague teste para fazê-lo passar.
- Se qualquer comando for negado, pare e relate; nunca contorne trocando de branch, diretório ou comando.
- Se um comando composto for bloqueado por falso positivo do hook, rode os comandos separados; se ainda assim for bloqueado, pare.
- Regra de domínio que não está em `docs/domain.md`: pergunte, não presuma.
- Não amplie o escopo além do plano.
- Se uma etapa falhar, pare e relate.
