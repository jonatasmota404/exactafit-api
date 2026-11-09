---
name: conversar
description: Use quando o humano quiser entender o projeto conversando em vez de ler documentação, por exemplo "o que esse módulo faz e por quê?", "o que mudou desde X?", "em que pé estamos?", "onde estou?", "qual o risco de mexer em Y?", "por que essa decisão foi tomada?", "como faço Z?" ou "por que isso foi bloqueado?". Responde curto, em português, com evidência (arquivo:linha, commit, PR, regra de docs/domain.md, ADR, teste) ou "não verificado". Só lê. Não use para implementar, planejar nem revisar.
---

# Conversar com o projeto

Só lê: não edita arquivos, não faz commit, não troca de branch e não roda comando que altera estado (instalar, migrar, formatar com escrita). A única escrita é o registro de domínio, e só depois do "sim" do humano (última seção).

## Como responder
- Português, linguagem natural, curto: até cinco linhas. Aprofunde só se o humano pedir ("detalha", "mostra o código", "e o resto?").
- Cada afirmação leva a evidência ao lado: `arquivo:linha`, hash do commit, número do PR, ID da regra em `docs/domain.md`, ADR, nome do teste, ou o comando com a saída. Sem evidência, escreva **"não verificado"**.
- Estado do projeto (branch, PRs, CI, o que mudou) se confere com comando na hora, nunca de memória.
- O porquê de uma decisão vem de ADR, `docs/domain.md`, descrição de PR ou mensagem de commit. Se não estiver em nenhum deles, diga "não registrado" e pergunte ao humano; não deduza.
- Feche com o próximo passo, ou com a pergunta que destrava, quando houver.

## Onde procurar
| Pergunta | Fontes |
|---|---|
| O que esse módulo faz e por quê | ponto de entrada e chamadas no código; testes do módulo (o comportamento esperado); regras de `docs/domain.md`; ADRs; `git log --follow --oneline -- <caminho>` e a descrição do PR que o criou |
| O que mudou desde X (data, tag, commit, PR) | `git log --oneline <X>..HEAD` ou `--since=<data>`; `git diff --stat <X>..HEAD`; `gh pr list --state merged --search "merged:>=<data>"` e a descrição de cada PR |
| Em que pé estamos / onde estou / próximo passo | `git status -sb`, `git branch --show-current`, `git log --oneline main..HEAD`; `gh pr list --state open` e `gh pr checks`; planos em `docs/plans/` (com `Aprovado por: —` ou `[DÚVIDA:`); `CONFIRMAR(humano)` e `TODO(humano)` em `docs/domain.md` |
| Qual o risco de mexer em Y | quem chama Y (`git grep`); testes que cobrem Y e o que fica sem teste; zonas de risco do `AGENTS.md`; regras de `docs/domain.md` ligadas; histórico de correções (`git log --oneline -- <Y>`, commits `fix`). Responda com o nível (baixo, médio, alto) da tabela "Risco" do `AGENTS.md` e o porquê |
| Por que essa decisão foi tomada | ADRs; `docs/domain.md`; commit que introduziu o trecho (`git log -S '<trecho>' --oneline`) e o PR dele (`gh pr list --state merged --search <hash>`) |
| Como faço Z | `fluxo.md` nesta pasta, `AGENTS.md`, o `description` das skills em `.claude/skills/`, `docs/OPCIONAL.md`. Responda com o comando exato para copiar |

Sem `gh` disponível: "não verificado (gh indisponível)" e siga só com o git.

## Canal do conhecimento de domínio
Quando o humano disser algo de domínio que o código e `docs/domain.md` não mostram (regra, exceção, número de limite, motivo de negócio):
1. Repita em uma linha, com as palavras dele.
2. Se contradiz uma regra ou ADR existente, aponte o conflito e pergunte qual vale.
3. Proponha: "Registro em `docs/domain.md`? (skill `registrar-decisoes`)". Só registre com o sim; sem resposta, não grave.

## Nunca
- Ler ou imprimir `.env` e segredos.
- Inventar comando, flag, skill, regra ou motivo.
- Decidir pelo humano: proponha e espere.
