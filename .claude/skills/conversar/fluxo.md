# Fluxo do kit: quero isto → faça isto

Referência da skill `conversar` para "como faço Z?". O humano não precisa ler este arquivo: pergunta, e a skill responde com a linha certa.

## Tarefas
| Quero | Faça |
|---|---|
| Entender o projeto, um módulo, uma decisão ou o estado atual | Pergunte em linguagem natural; a skill `conversar` responde |
| Mapear um repositório sem documentação | `use a skill mapear-projeto` (só lê; gera regras candidatas para `docs/domain.md`) |
| Fechar as regras de domínio pendentes | `use a skill entrevistar-dominio` (uma pergunta por vez) |
| Gravar uma decisão que tomei | `use a skill registrar-decisoes` |
| Mudança pequena, local e com teste (risco baixo) | Peça direto. O agente vai sozinho até o PR; você lê o resumo e mergeia |
| Corrigir um bug fora de zona de risco | `use a skill corrigir-bug: <sintoma e como aparece>` |
| Regra de negócio nova (risco médio) | `use a skill planejar-tarefa: <intenção>`; aprove os critérios de aceite na conversa; depois `use a skill executar-tarefa` |
| Dinheiro, dados, autenticação, migrations, contrato externo (risco alto) | Igual ao médio, mais o plano de risco em `docs/plans/` (aprove critérios e plano); no fim, rode o comportamento pelo passo "Validação do humano" do PR |
| Revisar segurança de trabalho arriscado | `use a skill seguranca` |
| Ver o que falta configurar no kit | `grep -rn "TODO(projeto)" .` |
| Ligar uma peça opcional (RETRO, aviso de doc, mutation testing, gates de CI) | `docs/OPCIONAL.md` |

## Antes do merge (só o humano)
- Baixo: leia o resumo e a evidência do PR; CI verde; mergeie pelo GitHub.
- Médio: confira que os critérios no PR são os que você aprovou e que cada um tem teste.
- Alto: rode o comportamento com o passo "Validação do humano" do PR e marque a caixa.
- O agente nunca faz merge nem push na `main`.

## Marcadores
| Marcador | Significa |
|---|---|
| `[DÚVIDA: …]` | Pergunta sem resposta; critérios ou plano não são aprovados nem executados até você responder |
| `TODO(projeto)` | Configuração do kit que o projeto ainda não preencheu |
| `CONFIRMAR(humano)` / `TODO(humano)` | Regra de domínio esperando sua decisão em `docs/domain.md` |
| `SUGESTÃO(IA, não confirmada)` | O agente supôs; confirme ou corrija |
| `Teste alterado: <motivo>` | Mudança intencional num teste existente (silencia o aviso de teste) |

## Quando algo trava
| Situação | O que fazer |
|---|---|
| Comando negado (hook ou permissão) | O agente para e relata. Não peça para contornar. Falso positivo conhecido: texto perigoso em mensagem de commit ou corpo de PR; use `git commit -F <arquivo>` ou `gh pr create --body-file <arquivo>` |
| O revisor reprovou 3 vezes | O agente para com um diagnóstico; em geral o problema está nos critérios ou no teste |
| O agente quer instalar um pacote | Só com a conferência do pacote no registro (comando e saída) e a sua aprovação |
| Erro logo depois de editar um arquivo | O hook `lint-on-edit` rodou o `onEdit` de `.claude/verify.json` nesse arquivo; o agente corrige na hora |
| O hook de Stop não deixa encerrar | Typecheck, teste ou lint falhando; a saída mostra qual |
| Aviso de teste | Um teste foi apagado, desativado ou perdeu verificações; confira se foi intencional |

## Limites conhecidos das barreiras
- Os hooks casam texto: não analisam `eval`, `bash -c` nem scripts.
- Branch criada antes de um hook entrar na `main` não o tem; incorpore a `main` primeiro.
- `settings.local.json` e `~/.claude` não são versionados; a proteção robusta da `main` é a do GitHub (`INSTALL.md` do kit).
- O revisor e o revisor de plano são IA: têm pontos cegos. Em autenticação, dados e segredos, a camada robusta são os gates objetivos no CI (varredura de segredos, auditoria de dependências, análise estática) e a validação do humano.
- Só em prosa, sem imposição: dependência nova com aprovação, teto de ~300 linhas de diff de produção (há gate opcional em `docs/OPCIONAL.md`), testes antes do código (o revisor confere a ordem dos commits).
- Autonomia total (sem pedir permissão) só dentro de container ou VM isolada, com branch própria e token sem permissão de merge.
