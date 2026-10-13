---
name: mapear-projeto
description: Use ao chegar num repositório sem documentação confiável, ou quando pedirem para mapear, documentar a arquitetura ou extrair regras de negócio do código. Só lê código; produz regras candidatas para docs/domain.md marcadas CONFIRMAR(humano) e perguntas ao humano. A visão geral para o humano é do curador do manual. Não use para implementar nem para registrar decisões já tomadas (use registrar-decisoes).
---

# Mapear projeto

Leitura do código, sem alterá-lo. O único arquivo escrito é `docs/domain.md`; as perguntas vão na resposta ao humano. A visão geral (módulos, fluxos) é escrita pelo curador do manual, fora do repositório, seguindo os passos 2 e 3.

## Regra central
Afirmação sobre ambiente (dependências, build, versões, CI, deploy, banco) exige **comando executado e saída citada**. Sem execução, escreva **"não verificado"**. Ler o `package.json` não prova o que está instalado nem como é feito o deploy.

## Passos
1. Leia `AGENTS.md`/`README` e os comandos que eles declaram. Não invente comandos.
2. Ache os pontos de entrada, módulos, rotas e o schema de dados.
3. Levante, sem gravar no repositório (é a base para as regras e as perguntas):
   - **Módulos:** um parágrafo por módulo: o que faz, o que **não** faz e de quem depende.
   - **Rotas:** método, caminho, autenticação, handler.
   - **Fluxos ponta a ponta:** 2–4 fluxos principais, passo a passo, com `arquivo` e `função` em cada passo.
   - **Zonas de risco e dívidas:** código sem teste, duplicação, acoplamento, validação/autenticação, migrations, segredos. Cite `arquivo:linha`.
4. Extraia as regras implícitas para `docs/domain.md` (validações, limites, unicidade, permissões, cascatas). Uma linha por regra, com onde aparece, marcada `CONFIRMAR(humano)`. Descreva o que o código faz, sem julgar se está certo.
5. Termine com **no máximo 10 perguntas** sobre o que o código não responde (intenção do produto, deploy, regra ambígua). Ordene pela que mais trava decisões.

## Não faça
- Não corrija código nem abra tarefas: registre como dívida.
- Não chame algo de "pré-existente" sem conferir na branch principal limpa.
- Não preencha intenção de negócio com palpite: use `TODO(humano)`.
