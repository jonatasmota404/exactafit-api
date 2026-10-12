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
| Tarefa `pipeline/conhecimento` (decisão do humano) | O aviso de documentação começa como aviso, não bloqueio. Deve virar bloqueio se for ignorado repetidamente; a decisão é do humano, depois de 2 semanas de dados. | Sem dados, bloquear pode travar tarefas sem impacto real; só avisar pode ser ignorado e deixar a dívida de conhecimento passar. | `.claude/hooks/doc-warning.mjs`; `AGENTS.md` → Fluxo de trabalho 8 |
| Domínio (`docs/dominio-2` e `docs/dominio-3`) | Duas branches paralelas de documentação editaram as mesmas regras (U3, C1, C4/S9) e a numeração de ADR (dois ADR 0004), gerando regra contraditória e número duplicado. | A contradição só aparece na hora de juntar e obriga o humano a decidir de novo. | `AGENTS.md` → Fluxo de trabalho 10; aviso de ADR duplicado em `doc-warning.mjs` |
| Domínio (relato do humano) | Sugestões do assistente de chat geraram três conflitos com regras já registradas, porque não foram conferidas contra o `domain.md`; a skill de entrevista pegou os conflitos antes de gravar. | Regra gravada sem conferência contradiz o que o humano já decidiu. | skill `entrevistar-dominio` (já existente); sem regra nova |
