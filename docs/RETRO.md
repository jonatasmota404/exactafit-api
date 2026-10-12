# Retro do pipeline

Uma linha por tarefa (ou por lição). Serve para transformar erro repetido em regra.

## Como adicionar uma linha
1. Ao fechar a tarefa (antes do merge), adicione uma linha no fim da tabela do ciclo atual.
2. **O que aconteceu:** fato observável, com commit/PR quando houver. Sem culpado.
3. **Por que importa:** o custo real ou o risco.
4. **Onde virou regra:** arquivo e seção (`AGENTS.md`, skill, hook, template). Se não virou regra, escreva `—` e o motivo.
5. Tarefa sem lição também entra, com "sem ocorrências" na coluna 1.

## Ciclo 1 — template, mapeamento e domínio (2026-10)

| Tarefa | O que aconteceu | Por que importa | Onde virou regra |
|---|---|---|---|
| Mapeamento (`0110586`) | Afirmou que `dotenv` era dependência transitiva **de desenvolvimento** sem rodar comando. `npm ls dotenv --omit=dev` mostrou que estava na árvore de produção; corrigido em `7a9b014`. | Severidade e decisão (deploy, dependência direta) partiram de uma premissa falsa. | `AGENTS.md` → Regras de verificação 2; skill `mapear-projeto` (regra central) |
| Ciclo 1 (relato do humano) | O assistente classificou um problema como "pré-existente"/"dívida antiga" sem conferir na `main`. A premissa errada veio do assistente e foi corrigida pelo agente ao reproduzi-lo na `main` limpa. | Esconde regressão nova atrás de dívida conhecida. | `AGENTS.md` → Regras de verificação 1 |
| Ciclo 1 (prevenção, não houve incidente) | Branch dependente de outra deve nascer da `main` atualizada, e o merge é por merge commit, não squash, que reescreve os commits de que ela depende. | Evita conflitos e commits duplicados no merge. | `AGENTS.md` → Fluxo de trabalho 2 |
| Domínio (`7a9b014`, `d5c5404`) | Regras de negócio só foram fechadas depois de perguntas explícitas ao humano. | Regra presumida vira código errado difícil de detectar. | `AGENTS.md` → anti-overengineering 7; skills `registrar-decisoes` e `planejar-tarefa` |
| Tarefa do `dotenv` (`d5c6e56`, relato do humano) | Incidente: a tarefa rodou em Opus quando a recomendação era Haiku. | Qualidade abaixo do esperado em texto que vira base de outros projetos. | `AGENTS.md` → Fluxo de trabalho 1 |
| Ciclo 1 | `.claude/settings.local.json` só era ignorado pelo `~/.config/git/ignore` de uma máquina (`git check-ignore -v`); o repositório não o ignorava, nem variantes como backups. | Em outro clone, permissões e caminhos locais podem ser commitados. | `.gitignore` (`.claude/settings.local.json*`) |
| Domínio (`docs/dominio-3`) | Decisões de offline, dataset e cardio fechadas por entrevista. A primeira escolha do critério da sessão aberta ("última a chegar") foi revista no mesmo dia por causa do caso de sessão esquecida. | O critério inicial encerraria a sessão de hoje por causa de uma sessão antiga enviada tarde. | `docs/domain.md` S3 |
| Entrevista | O agente tomou duas decisões "por delegação" (limite de tentativas de login e "pelo menos um dos dois obrigatório" em F4); sinalizou e deixou revisável, mas a skill não definia o tratamento. | Uma decisão do agente pode passar por decisão do humano. | skill `entrevistar-dominio` → Delegação |
| Merge | O agente executou um merge apesar de a instrução dizer "sem merge". Causa: [PREENCHER PELO HUMANO: aprovei o pedido de confirmação \| não houve pedido de confirmação]. Ação: [PREENCHER PELO HUMANO]. | Merge na `main` é irreversível para quem já puxou e publica o trabalho. | `AGENTS.md` → Fluxo de trabalho 8 |
