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
| Ciclo 1 (relato do humano) | Problema classificado como "pré-existente"/"dívida antiga" sem conferir na `main`. | Esconde regressão nova atrás de dívida conhecida. | `AGENTS.md` → Regras de verificação 1 |
| Ciclo 1 (relato do humano) | Branch dependente de outra não nasceu da `main` atualizada, e squash reescreveu os commits de que ela dependia. | Conflitos e commits duplicados no merge. | `AGENTS.md` → Fluxo de trabalho 2 |
| Domínio (`7a9b014`, `d5c5404`) | Regras de negócio só foram fechadas depois de perguntas explícitas ao humano. | Regra presumida vira código errado difícil de detectar. | `AGENTS.md` → anti-overengineering 7; skills `registrar-decisoes` e `planejar-tarefa` |
| Ciclo 1 (relato do humano) | Tarefa recomendava um modelo e a sessão rodou com outro. | Qualidade abaixo do esperado em texto que vira base de outros projetos. | `AGENTS.md` → Fluxo de trabalho 1 |
| Ciclo 1 | `.claude/settings.local.json` só era ignorado pelo `~/.config/git/ignore` de uma máquina (`git check-ignore -v`); o repositório não o ignorava, nem variantes como backups. | Em outro clone, permissões e caminhos locais podem ser commitados. | `.gitignore` (`.claude/settings.local.json*`) |
