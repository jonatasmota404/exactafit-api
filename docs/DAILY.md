# Ritual diário

Objetivo: usar a capacidade humana só onde ela rende (intenção, plano, risco, aceite) e deixar o resto para a esteira.

## Projeto novo (uma vez)
Antes do primeiro commit do agente: ligar a proteção da main no GitHub (PR obrigatório, CI obrigatório, vale para administradores); instalar o kit (INSTALL.md do kit) e ajustar comandos e pastas de risco (PROJECT-ADJUST.md).

## Início (10 min)
1. Peça `retomar` ao curador (`claude --agent curador-do-manual --add-dir ~/manuais/<projeto>`; só lê) ou leia `~/manuais/<projeto>/STATUS.md` (o manual fica fora do repositório).
2. Escolha UMA tarefa da fila. Cabe em 30 a 60 min? Se não, quebre.
3. Classifique o risco: baixo (local, reversível, com teste), médio (regra de negócio nova) ou alto (dinheiro, dados, auth, migrations, contrato externo).
4. `git switch main && git pull --ff-only`, abra uma sessão nova e troque o modelo com /model conforme a fase.

## Planejar (risco médio ou alto; baixo vai direto)
Responda por escrito no plano (docs/PLAN_TEMPLATE.md):
- Qual o problema real e qual o critério de aceite testável?
- Qual o raio de impacto e é reversível?
- Qual a menor mudança que resolve? Precisa de abstração ou dependência nova? (skill menor-esforco)
- Toca autenticação, dados pessoais, entrada externa, segredos ou dependências, em risco médio ou alto? (skill seguranca; o plano ganha a seção "Segurança")
- Que regra de negócio a IA não tem como saber? (pergunte; não presuma)
- Quais arquivos serão tocados? Qualquer outro no diff é suspeito.
- Como provo que funciona sem ler tudo?
- Qual doc muda? (ou "Sem impacto em doc: motivo")
A skill planejar-tarefa faz antes uma entrevista curta, escalada pelo risco: o agente investiga e pergunta para você confirmar, uma pergunta por vez. Plano gerado em modo leitura; você corta o excesso e aprova ANTES de qualquer código.

## Modelo por fase
- Planejar e revisar: modelo mais forte (poucas chamadas, alto valor).
- Implementar: modelo intermediário; modelo leve só para tarefa mecânica e sem decisão.
- Documentação estruturada: modelo leve.

## Executar (automático)
Os dois comandos do dia, cada um em sessão nova:
1. `use a skill planejar-tarefa: <intenção>` (modelo mais forte). Você corta o excesso e aprova.
2. `use a skill executar-tarefa com o plano docs/plans/<arquivo>.md` (modelo intermediário).
Testes primeiro, implementação em loop até typecheck, testes e lint (só verificação) passarem, e revisor em sessão limpa. Seu papel: não interferir. Se travar, pare e replaneje; não force. O agente nunca faz merge nem push na main.
Uma sessão por diretório de trabalho; para sessões paralelas, use `git worktree add ../<repo>-<branch> <branch>`.

## Aceitar (você)
- Leia o diff dos pontos de risco e da documentação; não leia tudo.
- Rode o fluxo real (integração, aparelho, curl).
- Risco médio ou alto: na sessão do curador (`claude --agent curador-do-manual --add-dir ~/manuais/<projeto>`), peça `briefing <plano>` e responda às perguntas antes de mergear.
- CI verde. PR e MERGE são seus.

## Fim do dia (5 min)
1. Confira que o "Resultado" do plano (com o bloco "Para o manual") está preenchido e que o aviso de documentação não disparou. Depois, na raiz do projeto, rode `claude --agent curador-do-manual --add-dir ~/manuais/<projeto>` e peça `sincronizar`.
2. Uma linha em docs/RETRO.md por erro repetido ou surpresa: o que aconteceu, por que importa, onde virou regra.
3. Anote por tarefa: risco, modelos usados, cota gasta (aproximada), minutos seus, retrabalho (sim/não) e quem pegou o erro (hook, teste, revisor ou você).
4. Feche branches mergeadas e escolha a tarefa de amanhã.

## Semanal
- Remova UMA peça do fluxo (um passo, uma regra) e veja se a qualidade cai. Se não caiu, era peso.
- Reveja o RETRO.md: erro que se repetiu três vezes vira hook ou skill.
- AGENTS.md ainda cabe em uma tela? Se não, enxugue.
