# Pipeline de desenvolvimento com IA

Manual do kit. Vale para qualquer projeto. O que é específico de um projeto fica em docs/domain.md, docs/architecture.md e nos ADRs.

## 1. Princípio
O humano decide o que é correto, o que é arriscado e o que importa. A IA executa em escala. Autonomia se compra com verificação objetiva (testes, tipos, lint, CI, hooks, revisor em sessão limpa), nunca com confiança. A mão humana entra só onde um erro custa caro ou onde só o humano sabe a resposta. O objetivo é sistemas robustos sem slop.

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
4. Plano (skill planejar-tarefa) em docs/plans/: critérios testáveis, risco, arquivos a tocar (qualquer outro no diff é suspeito), abstrações novas (padrão: nenhuma), dependências novas (só com aprovação), como verificar, doc que muda ("Sem impacto em doc: motivo" se nenhuma), fora de escopo, perguntas ao humano. O humano aprova.
5. Testes primeiro nos riscos médio e alto: os critérios viram testes que falham.
6. Implementar em tarefas pequenas, um commit cada, até typecheck, testes e lint passarem.
7. Revisor em sessão limpa: complexidade desnecessária, regras de negócio, segurança, documentação atualizada.
8. Documentação no mesmo PR (architecture, domain ou ADR), seção "Resultado" do plano preenchida e docs/STATUS.md atualizado.
9. PR com o template, CI verde, humano lê e mergeia.
10. Retro: uma linha em docs/RETRO.md por erro repetido ou surpresa.

Perguntas do planejamento (o humano responde por escrito): qual o problema real e como saberei que acabou? Qual o raio de impacto e é reversível? Qual a menor mudança que resolve, e precisa de abstração ou dependência nova? Que regra de negócio a IA não tem como saber? Quais arquivos serão tocados? Como provo que funciona sem ler tudo? Qual doc muda? Cabe em 30 a 60 minutos?

## 4. Modelo e tokens
- Planejar e revisar: modelo mais forte (poucas chamadas, alto valor).
- Implementar: modelo intermediário. Modelo leve só para tarefa mecânica e sem decisão, e para documentação estruturada.
- O modelo da sessão é definido no início: troque com /model antes de abrir, conforme a recomendação da tarefa. O agente não troca no meio.
- Sessão nova por tarefa, contexto limpo, AGENTS.md curto, subagente para pesquisa ruidosa (só o resumo volta).
- Meça por tarefa: modelos usados, cota gasta, minutos humanos, retrabalho e quem pegou o erro (hook, teste, revisor ou humano). A comparação entre modelos leve e intermediário ainda precisa de dados.

## 5. Barreiras (camadas independentes)
Robustas (valem em qualquer checkout, fora do alcance do agente):
- Proteção da main no GitHub: PR obrigatório, check `build-and-check` obrigatório, vale para administradores, sem force push, sem exclusão.
- Deny no settings do usuário (`~/.claude/settings.json`) para `gh pr merge` e escrita via `gh api`.
- Hooks versionados no repositório: guard-main (bloqueia push e merge na main, `gh pr merge`, `gh api` de escrita, push com expansão de shell, pull sem `--ff-only`), block-destructive (rm -rf, push forçado, reset --hard, migrate reset, SQL destrutivo, leitura de segredos), verify-on-stop (typecheck, testes e lint:check; bloqueia na primeira falha e só avisa na segunda), doc-warning (apenas avisa: código sem doc, link quebrado, ADR duplicado).
- Allow, ask e deny do settings.json do projeto; ask nas zonas de risco (migrations, schema, auth, workflows, package.json, .claude).
Frágeis (saiba onde estão):
- Os hooks casam texto: não analisam eval, `bash -c` nem scripts. Dão falso positivo quando o padrão perigoso aparece só como texto (contorno: gravar o texto num arquivo fora do repositório).
- Branch criada antes de um hook entrar na main não o tem; incorpore a main primeiro.
- settings.local.json e ~/.claude não são versionados.
- O revisor não tem Edit nem Write, mas tem Bash livre; só a prosa o impede de escrever por shell. Isolamento real exige container.
- Só em prosa, sem imposição: dependência nova só com aprovação, teto de diff de produção (~300 linhas), STATUS atualizado, RETRO por tarefa, aviso do modelo.
Regra de ouro: se qualquer comando for negado, pare e relate. Nunca contorne trocando de branch, diretório ou comando, e nunca atribua ao humano uma autorização que ele não deu.
Autonomia total (sem pedir permissão) só dentro de container ou VM isolada, com repositório limpo, branch própria e token sem permissão de merge.

## 6. Documentação viva (a defesa contra a dívida de conhecimento)
- AGENTS.md (CLAUDE.md só o importa): comandos, convenções, proibições, regras anti-overengineering. Curto.
- docs/domain.md: fonte da verdade das regras de negócio. A IA nunca presume; pergunta.
- docs/architecture.md: um parágrafo por módulo (o que faz, o que NÃO faz, de quem depende), rotas, fluxos, zonas de risco.
- docs/adr/: uma decisão estrutural, o porquê e as alternativas descartadas.
- docs/plans/: o plano e o "Resultado" de cada tarefa (o registro do que foi feito e por quê).
- docs/STATUS.md: estado atual, últimas tarefas, próximos passos e pendências do humano (leitura de retomada).
- docs/RETRO.md: erros do processo e onde cada um virou regra, hook ou skill.
- docs/DAILY.md: o ritual diário e semanal.
Definição de pronto: toda tarefa que muda rota, schema, regra ou módulo atualiza a documentação no mesmo commit ou declara "Sem impacto em doc: motivo". Depois de uma semana parado, leia na ordem: STATUS, RETRO (últimas linhas), DAILY, domain, ADRs recentes e architecture (cerca de 45 minutos).

## 7. Ritual
Diário e semanal: docs/DAILY.md. No fim do dia: preencher o "Resultado" do plano, atualizar o STATUS, escrever a retro e anotar as métricas. Por semana: remover UMA peça do fluxo e ver se a qualidade cai (se não caiu, era peso); transformar erro que se repetiu três vezes em hook ou skill; enxugar o AGENTS.md.

## 8. Projeto novo (checklist do kit)
Antes do primeiro commit do agente: ligar a proteção da main no GitHub, conferir o deny no ~/.claude/settings.json e copiar o kit.
- Copiar como está: hook guard-main e seu teste, as skills (entrevistar-dominio, mapear-projeto, planejar-tarefa, registrar-decisoes), DAILY.md, estrutura do RETRO.md (esvaziar o conteúdo), template de PR, ADR 0000 e este manual.
- Copiar e ajustar: verify-on-stop e doc-warning (comandos e pastas de código), block-destructive (regras de Prisma, Docker e .env), settings.json (scripts e zonas de risco), subagentes (stack e checklist do revisor), AGENTS.md (stack, comandos, estrutura), PLAN_TEMPLATE.
- Específico, não copiar: domain, architecture, ADRs, STATUS, CI e docker-compose.
Ordem em projeto de back-end com front separado: (1) kit e proteção; (2) mapear o projeto e entrevistar o domínio; (3) contrato OpenAPI na API, para o front gerar cliente tipado e a quebra de contrato falhar na checagem de tipos; (4) o front nasce do mesmo kit, com comandos, zonas de risco (config do app e pastas nativas) e testes próprios, e a decisão de offline já registrada.

## 9. Lições dos incidentes
- Premissa não conferida na main limpa gera falso diagnóstico (o lint "antigo" era do trabalho em andamento).
- Afirmação sobre ambiente exige comando e saída; sem execução, "não verificado". Vale também para mensagens humanas ao agente.
- Obstáculo de segurança é sinal para parar, não para contornar.
- Barreira que mora numa branch não protege branches antigas; as robustas ficam fora do alcance do agente.
- Branches paralelas editando as mesmas regras e a numeração de ADR geram conflito: uma branch de docs ou pipeline por vez.
- Sugestão do assistente deve ser conferida contra o domain.md antes de aceita; a skill de entrevista pega o conflito antes de gravar.
- Decisão por delegação só vale se o humano delegou aquele ponto; fica marcada e revisável. Números de limite nunca são sugeridos sem base.
- Sessão do agente e comandos do humano no mesmo diretório se atrapalham (stash, merge em andamento): worktree separado.
- Teste de caracterização trava o comportamento atual antes de mudar o código e revela divergências do domain.md.
- A entrevista de domínio expôs problemas de design (limite de fichas, falha calculada, cascata) que nenhum teste pegaria.

## 10. IA em conteúdo, design, áudio e vídeo (a testar)
Princípios, ainda sem pipeline validado: a IA gera variações e rascunhos rápidos, o humano dá a direção (briefing, referências, restrições, ponto de vista) e o gosto. É preciso dominar os fundamentos (hierarquia visual, ritmo, estrutura narrativa) para julgar o resultado. Anti-slop: edição pesada, fatos checados, e algo que só o autor diria. Quando houver o primeiro projeto de conteúdo, aplique o mesmo ciclo (intenção, plano, verificação, aceite, retro) e registre o que funcionou.

## 11. Limites conhecidos
O pipeline foi validado em um projeto de back-end. Os pontos em prosa da seção 5 e a calibragem de modelos (seção 4) ainda dependem de dados. Reavalie o manual a cada ciclo: o que não mudar o resultado, remova.
