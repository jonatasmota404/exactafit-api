---
name: sistema-de-design
description: Use quando o projeto tem interface e não tem docs/design/README.md, ou quando o humano quer refazer ou ampliar o design system (nova direção visual, marca, aparelho novo). Investiga as telas e o domínio, entrevista o humano sobre quem usa e onde, propõe 2 ou 3 direções com prévia para ver, e grava princípios, tokens e componentes base em docs/design/. Não use para desenhar uma tela isolada dentro de um design system que já existe (siga docs/design/ e use frontend-design) nem para mudar código de produto.
---

# Sistema de design

Cria a fonte única de verdade visual do projeto: quem usa, princípios, tokens e componentes base. Com ela, toda tela nova sai coerente com as outras, porque o agente segue regras em vez de inventar. O humano escolhe a direção e a marca; o agente investiga, propõe, grava e confere. Só escreve em `docs/design/`.

## Antes de começar
1. Leia `AGENTS.md`, `docs/domain.md` e, se existir, `docs/design/`.
2. Levante o que já existe no código, com evidência (arquivo:linha): cores, fontes, tamanhos de texto, espaçamentos, raios e sombras em uso, quantos valores diferentes de cada, e os componentes que se repetem. Mostre ao humano o resumo ("12 cinzas diferentes, 3 fontes, botão em 4 tamanhos").
3. Só então faça a primeira pergunta.

## Entrevista (uma pergunta por vez)
Pergunte só o que o código e o domínio não respondem. Registre com as palavras do humano.
- **Quem usa e em qual aparelho:** papel, aparelho (desktop, celular, tablet), condição de uso (pressa, em pé, luz forte, de longe, mão ocupada), quanto tempo por dia.
- **As 3 tarefas mais frequentes** de cada um: é nelas que a direção visual é julgada.
- **Densidade:** muita informação por tela (listas longas, conferência) ou pouca e grande (toque rápido)?
- **Marca:** nome, logo e cor que já existem e se são fixos ou configuráveis por cliente. Sem marca, diga isso; não invente logo.
- **Sensação e referências:** 2 ou 3 adjetivos do que o produto deve passar, e produtos que o humano acha bons ou ruins nisso.
- **Acessibilidade e idioma:** usuários com baixa visão, daltonismo, uso só com teclado; idioma e tom do texto da interface.

"Ainda não sei" é resposta válida: vira `TODO(humano)` no README.

## Direções
1. Com a skill `frontend-design`, proponha **2 ou 3 direções** distintas que atendam à entrevista. Cada uma numa tabela com: caráter, cor de marca, tipografia (títulos, texto, números), tamanho do texto base, raio, borda e sombra, altura de controle e alvo mínimo de toque, densidade.
2. Abaixo da tabela, uma linha por direção: "Escolha X se <prioridade da entrevista>". Não diga qual prefere; o humano escolhe.
3. Grave uma prévia por direção em `docs/design/previews/<direcao>.html`: arquivo único, sem dependência além de fontes, mostrando os componentes base e **uma tela real da tarefa mais frequente**, com dados de exemplo do domínio, na largura de cada aparelho da entrevista. Diga ao humano como abrir.
4. Espere a escolha. Ajuste pedido pelo humano gera nova prévia antes de gravar.

## O que gravar (depois da escolha)
- `docs/design/README.md`:
  - **Quem usa e em qual aparelho** (tabela: aparelho, quem, o que muda na interface);
  - **Princípios**: de 5 a 8, cada um verificável numa tela ("situação por rótulo, cor e ícone, nunca só cor"), não adjetivo;
  - **Direção escolhida** e por quê, com as descartadas em uma linha cada;
  - **Marca**: quais tokens mudam se a marca mudar e quais nunca vêm da marca (erro, aviso, sucesso);
  - **Como usar os tokens**: nunca valor solto; qual token para texto, superfície, borda, foco, estado;
  - **Estados** do domínio (situações, status) com rótulo, ícone e tokens;
  - **Contraste** (abaixo) e **texto da interface** (tom, verbos nos botões, como escrever erro).
- `docs/design/tokens.json`, só a direção escolhida, cada token com `name`, `value` e `usage`, nos grupos `color`, `type` (famílias e estilos de texto com tamanho, peso e altura de linha), `spacing` (uma escala, ex. grade de 4px), `radius`, `border`, `shadow` e `size` (altura de controle, alvo mínimo de toque).
- `docs/design/components/<Nome>/README.md` para os componentes base que as telas usam (no mínimo: botão, campo, seletor, lista ou tabela, estado vazio, estado de erro, aviso): para que serve, variantes, estados (normal, foco, desabilitado, carregando, erro), tokens usados, quando não usar.

## Conferir antes de entregar
- **Contraste** (WCAG 2.2 AA): texto 4,5:1 (3:1 para texto grande), borda de controle, anel de foco e ícone com significado 3:1 sobre cada superfície. Calcule cada par com `node .claude/skills/sistema-de-design/contraste.mjs <cor-do-texto> <cor-do-fundo>` e cole a tabela no README. Par que não passa: ajuste o token e calcule de novo.
- `tokens.json` válido (`node -e "JSON.parse(require('fs').readFileSync('docs/design/tokens.json','utf8'))"`) e todo token citado no README ou nos componentes existe nele (`grep`).
- Cada princípio tem um exemplo de tela que o cumpre.

## No final
1. Proponha ao humano, sem aplicar, uma linha para "Convenções" do `AGENTS.md`: "Tela nova ou alterada segue `docs/design/README.md`: só tokens e componentes de lá; token ou componente novo é decisão do humano."
2. Proponha o item de `docs/REVIEW.md`: "Diff de tela usa só tokens e componentes de `docs/design/`? Valor solto de cor, tamanho, espaçamento ou raio: IMPORTANTE."
3. Levar os tokens para o código (tema, variáveis, componentes) é **outra tarefa**: risco médio, pela skill `planejar-tarefa`. Liste as telas que mais divergem do sistema, com evidência, como sugestão de ordem.
4. Liste os `TODO(humano)` que ficaram.

## Nunca
- Escolher a direção, a cor da marca ou o logo pelo humano.
- Alterar código de produto, tema ou componente: aqui só `docs/design/`.
- Usar foto de banco de imagens, desenhar logo ou copiar a identidade de outro produto.
- Marcar contraste como aprovado sem o cálculo colado.
