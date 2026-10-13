# Pipeline de desenvolvimento com IA

Manual do pipeline. Vale para qualquer projeto. O que é específico de um projeto fica em docs/domain.md e nos ADRs (no repositório) e no manual do humano (fora dele; seção 6).

## 1. Princípio
O humano decide o que é correto, o que é arriscado e o que importa. A IA executa em escala. Autonomia se compra com verificação objetiva (testes, tipos, lint, CI, hooks, revisor em sessão limpa), nunca com confiança. A mão humana entra só onde um erro custa caro ou onde só o humano sabe a resposta. O objetivo é sistemas robustos sem slop.

Duas regras de pensamento valem em todo o ciclo. (1) Decisão de domínio (regra de negócio, o que o produto deve fazer, números de limite) é só do humano; decisão técnica o agente recomenda (UMA opção, 2 alternativas, trade-offs, reversibilidade) e o humano aprova. (2) O agente investiga primeiro e pergunta para confirmar; só vira regra o que tem evidência ou decisão explícita. A skill menor-esforco aplica a escada (não fazer, reaproveitar, configurar, menor mudança, usar pronto, construir) e a preguiça é de código e de decisão, nunca de verificação.

## 2. Quando o humano age (e só então)
1. Intenção e critério de aceite.
2. Classificação de risco.
3. Decisões de domínio que a IA não tem como saber. A IA pergunta e não presume.
4. Aprovação do plano, cortando o excesso (cortar aqui é barato).
5. Aceite: ler o diff dos pontos de risco e da documentação e rodar o fluxo real.
6. Merge, que é sempre do humano, e a retro.
Todo o resto roda sozinho dentro das barreiras da seção 5.

## 3. Ciclo de uma tarefa
Risco baixo (local, reversível, com teste) vai direto. Risco médio (regra de negócio nova) e alto (dinheiro, dados, auth, migrations, contrato externo) passam por plano.
1. Escolha UMA tarefa que caiba em 30 a 60 minutos; senão, quebre.
2. A branch nasce da main atualizada (`git pull --ff-only`). Uma sessão por diretório de trabalho; sessões paralelas usam `git worktree`.
3. Explorar em modo leitura.
4. Plano (skill planejar-tarefa) em docs/plans/, depois da entrevista por tarefa escalada pelo risco (baixo 0 a 3 perguntas, médio até 8, alto com reversibilidade, alternativas e pré-mortem): critérios testáveis, risco, menor esforço (skill menor-esforco), segurança em risco médio ou alto que toque autenticação, dados pessoais, entrada externa, segredos ou dependências (skill seguranca), arquivos a tocar (qualquer outro no diff é suspeito), abstrações novas (padrão: nenhuma), dependências novas (só com aprovação), como verificar, doc que muda ("Sem impacto em doc: motivo" se nenhuma), fora de escopo, perguntas ao humano. O humano aprova.
5. Testes primeiro nos riscos médio e alto: os critérios viram testes que falham.
6. Implementar em tarefas pequenas, um commit cada, até typecheck, testes e lint passarem.
7. Revisor em sessão limpa: complexidade desnecessária, regras de negócio, segurança, documentação atualizada.
8. Documentação no mesmo PR (domain ou ADR) e seção "Resultado" do plano preenchida, com o bloco "Para o manual". O curador leva isso ao manual do humano depois, em sessão própria.
9. PR com o template, CI verde, humano lê e mergeia.
10. Retro: uma linha em docs/RETRO.md por erro repetido ou surpresa.

Skills: o passo 4 é a skill planejar-tarefa; com o plano aprovado, a skill executar-tarefa conduz os passos 2 e 5 a 10 e para antes do merge.

Perguntas do planejamento (o humano responde por escrito): qual o problema real e como saberei que acabou? Qual o raio de impacto e é reversível? Qual a menor mudança que resolve, e precisa de abstração ou dependência nova? Que regra de negócio a IA não tem como saber? Quais arquivos serão tocados? Como provo que funciona sem ler tudo? Qual doc muda? Cabe em 30 a 60 minutos?

## 4. Modelo e tokens
- Planejar e revisar: modelo mais forte (poucas chamadas, alto valor).
- Implementar: modelo intermediário. Modelo leve só para tarefa mecânica e sem decisão, e para documentação estruturada.
- O modelo da sessão é definido no início: troque com /model antes de abrir, conforme a recomendação da tarefa. O agente não troca no meio.
- Sessão nova por tarefa, contexto limpo, AGENTS.md curto, subagente para pesquisa ruidosa (só o resumo volta).
- Meça por tarefa: modelos usados, cota gasta, minutos humanos, retrabalho e quem pegou o erro (hook, teste, revisor ou humano). A comparação entre modelos leve e intermediário ainda precisa de dados.

## 5. Barreiras (camadas independentes)
Robustas (valem em qualquer checkout, fora do alcance do agente):
- Proteção da main no GitHub: PR obrigatório, check de CI obrigatório, vale para administradores, sem force push, sem exclusão.
- Deny no settings do usuário (`~/.claude/settings.json`) para `gh pr merge` e escrita via `gh api`.
- Hooks versionados no repositório: guard-main (bloqueia push e merge na main, `gh pr merge`, `gh api` de escrita, push com expansão de shell, pull sem `--ff-only`), block-destructive (rm -rf, push forçado, reset --hard, `git branch -D` e `-d --force`, SQL destrutivo, leitura de segredos), verify-on-stop (typecheck, testes e lint que só verifica; bloqueia na primeira falha e só avisa na segunda), doc-warning (apenas avisa: código sem doc, link quebrado, ADR duplicado).
- Allow, ask e deny do settings.json do projeto; ask nas zonas de risco (migrations, schema, autenticação, workflows, manifesto de dependências, .claude).
Frágeis (saiba onde estão):
- Os hooks casam texto: não analisam eval, `bash -c` nem scripts. Dão falso positivo quando o padrão perigoso aparece só como texto (contorno: gravar o texto num arquivo fora do repositório).
- Branch criada antes de um hook entrar na main não o tem; incorpore a main primeiro.
- settings.local.json e ~/.claude não são versionados.
- O revisor não tem Edit nem Write, mas tem Bash livre; só a prosa o impede de escrever por shell. Isolamento real exige container.
- A skill seguranca e o item de segurança do revisor são IA: têm pontos cegos e não substituem o aceite humano em autenticação, dados e segredos. A camada robusta são os gates objetivos no CI do projeto (varredura de segredos, auditoria de dependências, análise estática); a skill apenas os recomenda.
- Só em prosa, sem imposição: dependência nova só com aprovação, teto de diff de produção (~300 linhas), "Resultado" do plano preenchido, RETRO por tarefa, aviso do modelo.
Regra de ouro: se qualquer comando for negado, pare e relate. Nunca contorne trocando de branch, diretório ou comando, e nunca atribua ao humano uma autorização que ele não deu.
Autonomia total (sem pedir permissão) só dentro de container ou VM isolada, com repositório limpo, branch própria e token sem permissão de merge.

## 6. Documentação viva (a defesa contra a dívida de conhecimento)
Dois contextos separados: o do agente (no repositório) e o do humano (o manual, fora dele). O agente de desenvolvimento nunca lê nem escreve o manual.

No repositório (fonte compartilhada):
- AGENTS.md (CLAUDE.md só o importa): comandos, convenções, proibições, regras anti-overengineering. Curto; só o que não se deduz do código.
- docs/domain.md: fonte da verdade das regras de negócio, com ID. A IA nunca presume; pergunta.
- docs/adr/: uma decisão estrutural, o porquê e as alternativas descartadas.
- docs/plans/: o plano e o "Resultado" de cada tarefa; o bloco "Para o manual" é o repasse ao curador.
- docs/RETRO.md: erros do processo e onde cada um virou regra, hook ou skill.
- docs/DAILY.md: o ritual diário e semanal.

No manual do humano (`~/manuais/<projeto>/`, criado a partir de `manual-template/` do kit; em projeto de empresa, só local):
- index.md: o que o sistema é, modelo mental, mapa de leitura; regras e ADRs só por link ao ID, nunca copiados.
- STATUS.md: fila, decisões pendentes do humano e riscos (só o não derivável do git).
- briefings/: briefing de cada plano ou PR de risco médio ou alto, com as respostas do humano.
- Mantido só pelo agente `curador-do-manual`, em sessão própria: `claude --agent curador-do-manual --add-dir ~/manuais/<projeto>` (modos `sincronizar`, `primeira-sincronizacao`, `briefing`).
- Para entender uma área sob demanda: skill `explicar`.

Definição de pronto: toda tarefa que muda rota, schema, regra ou módulo atualiza domain.md ou um ADR no mesmo commit ou declara "Sem impacto em doc: motivo". Depois de uma semana parado: no manual, STATUS e index; depois RETRO (últimas linhas), DAILY e ADRs recentes. Confira com o TESTE-DE-RETOMADA do manual.

## 7. Ritual
Diário e semanal: docs/DAILY.md. No fim do dia: conferir o "Resultado" do plano, sincronizar o manual com o curador, escrever a retro e anotar as métricas. Por semana: remover UMA peça do fluxo e ver se a qualidade cai (se não caiu, era peso); transformar erro que se repetiu três vezes em hook ou skill; enxugar o AGENTS.md.

## 8. Lições dos incidentes
- Premissa não conferida na main limpa gera falso diagnóstico.
- Afirmação sobre ambiente exige comando e saída; sem execução, "não verificado". Vale também para mensagens humanas ao agente.
- Obstáculo de segurança é sinal para parar, não para contornar.
- Barreira que mora numa branch não protege branches antigas; as robustas ficam fora do alcance do agente.
- Branches paralelas editando as mesmas regras e a numeração de ADR geram conflito: uma branch de docs ou pipeline por vez.
- Sugestão do assistente deve ser conferida contra o domain.md antes de aceita; a skill de entrevista pega o conflito antes de gravar.
- Decisão por delegação só vale se o humano delegou aquele ponto; fica marcada e revisável. Números de limite nunca são sugeridos sem base.
- Sessão do agente e comandos do humano no mesmo diretório se atrapalham (stash, merge em andamento): worktree separado.
- Teste de caracterização trava o comportamento atual antes de mudar o código e revela divergências do domain.md.
- A entrevista de domínio expõe problemas de design (limites, valores calculados, cascatas) que nenhum teste pegaria.
- Contexto do agente e do humano misturados no repositório: o agente gasta contexto com explicação que não usa e o humano perde o fio. A explicação vai para o manual, fora do repositório; o repositório guarda só o que o agente precisa e a fonte compartilhada (domain e ADRs).

## 9. IA em conteúdo, design, áudio e vídeo (a testar)
Princípios, ainda sem pipeline validado: a IA gera variações e rascunhos rápidos, o humano dá a direção (briefing, referências, restrições, ponto de vista) e o gosto. É preciso dominar os fundamentos (hierarquia visual, ritmo, estrutura narrativa) para julgar o resultado. Anti-slop: edição pesada, fatos checados, e algo que só o autor diria. Quando houver o primeiro projeto de conteúdo, aplique o mesmo ciclo (intenção, plano, verificação, aceite, retro) e registre o que funcionou.

## 10. Limites conhecidos
O pipeline foi validado até agora em um único projeto de back-end. Os pontos em prosa da seção 5 e a calibragem de modelos (seção 4) ainda dependem de dados. Reavalie o manual a cada ciclo: o que não mudar o resultado, remova.
