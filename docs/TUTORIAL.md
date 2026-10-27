# Tutorial: como usar o kit neste projeto

Guia de consulta rápida. Cada linha é "quero isto → digite isto". O porquê de cada peça está no `docs/PIPELINE.md`; a rotina do dia, no `docs/DAILY.md`. Na dúvida, pergunte ao agente "como faço X?": a skill `como-usar` responde a partir deste arquivo.

## 1. Primeira vez no projeto
| Quero | Faça |
|---|---|
| Entender um repositório sem documentação | `use a skill mapear-projeto` (só lê; gera regras candidatas para `docs/domain.md`) |
| Fechar as regras que ficaram pendentes | `use a skill entrevistar-dominio` (uma pergunta por vez) |
| Ver o que ainda falta configurar | `grep -rn "TODO(projeto)" .` |

## 2. Tarefa do dia a dia
| Quero | Faça |
|---|---|
| Fazer uma feature ou mudança | `use a skill planejar-tarefa: <o que quero>`, em sessão nova, com o modelo mais forte |
| Aprovar o plano | Leia o plano em `docs/plans/`, responda os `[DÚVIDA: …]`, corte o excesso e diga "aprovado" |
| Executar o plano aprovado | `use a skill executar-tarefa com o plano docs/plans/<arquivo>.md`, em sessão nova |
| Corrigir um bug | `use a skill corrigir-bug: <o que está errado e como aparece>` |
| Mudança pequena, local e com teste (risco baixo) | Peça direto; o hook de Stop roda typecheck, testes e lint antes de encerrar |

## 3. Antes do merge (só você)
1. Abra o PR e preencha o bloco **"Aceite do humano"**: diff de risco lido, só o que o plano pede, fluxo real rodado, CI verde, sabe reverter.
2. Mergeie pelo GitHub. O agente nunca faz merge nem push na `main`.

## 4. Entender e decidir
| Quero | Faça |
|---|---|
| Entender uma área do código | `use a skill explicar: <área ou pergunta>` |
| Gravar uma decisão que tomei | `use a skill registrar-decisoes` (vai para `docs/domain.md` ou ADR) |
| Saber se vale construir algo / caminho mais simples | `use a skill menor-esforco` |
| Revisar segurança de trabalho arriscado | `use a skill seguranca` |
| Saber se o revisor pega os defeitos | Receita 1 de `docs/RECEITAS.md` (defeitos plantados numa branch de treino) |
| Provar que a mudança de risco alto alterou só o alvo | Receita 2 de `docs/RECEITAS.md` (antes/depois); declare no "Como verificar" do plano |
| Saber onde estou, o que está pendente e o próximo passo | `use a skill onde-estou` (só lê; git, PRs, planos e dúvidas) |
| Voltar ao projeto depois de uma pausa longa, com o manual | `claude --agent curador-do-manual --add-dir ~/manuais/<projeto>` e peça `retomar` (só lê) |

## 5. Marcadores que você vai ver
| Marcador | Significa |
|---|---|
| `[DÚVIDA: …]` | Pergunta sem resposta no plano; o plano não roda até você responder |
| `TODO(projeto)` | Configuração do kit que o projeto ainda não preencheu |
| `CONFIRMAR(humano)` / `TODO(humano)` | Regra de domínio esperando sua decisão em `docs/domain.md` |
| `SUGESTÃO(IA, não confirmada)` | O agente supôs; confirme ou corrija |
| `Sem impacto em doc: <motivo>` | A tarefa declarou que nenhuma doc muda |
| `Teste alterado: <motivo>` | Mudança intencional num teste existente |

## 6. Quando algo trava
| Situação | O que fazer |
|---|---|
| Um comando foi negado (hook ou permissão) | O agente para e relata. Leia o motivo; não peça para contornar. Falso positivo conhecido: texto perigoso dentro de mensagem de commit ou PR; use `-F <arquivo>` / `--body-file` |
| O revisor reprovou 3 vezes | O agente para com um diagnóstico. Em geral o problema está no plano ou no teste: replaneje |
| O agente quer instalar um pacote | Só com a tabela "Dependências novas" do plano preenchida e sua aprovação |
| Erro logo depois de editar um arquivo | O hook `lint-on-edit` rodou o `onEdit` do `.claude/verify.json` nesse arquivo; o agente corrige na hora |
| O hook de Stop não deixa encerrar | Typecheck, teste ou lint falhando; a saída mostra qual |
| Aviso de documentação ou de teste | Só avisa: falta doc, ou um teste foi apagado ou desativado. Confira se foi intencional |
