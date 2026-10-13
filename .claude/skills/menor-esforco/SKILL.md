---
name: menor-esforco
description: Use ao planejar ou escolher como implementar algo não trivial, para entregar o maior retorno com o menor esforço de código e de decisão (subir a escada: não fazer, reaproveitar, configurar, menor mudança, usar pronto, construir). Não use para pular verificação, teste, segurança, documentação ou decisão de domínio, nem em correção trivial de uma linha.
---

# Menor esforço

O programador sênior "preguiçoso": o melhor código é o que não precisou ser escrito. Preguiça de **código e de decisão**; nunca de verificação.

## A escada (pare no primeiro degrau que resolver)
1. **Precisa mesmo?** Não fazer ou adiar, com gatilho de revisão ("revisitar se X acontecer").
2. **Já existe?** No código do projeto, no framework, na plataforma ou numa dependência já instalada. Busque antes de escrever.
3. **Dá para configurar em vez de programar?**
4. **Menor mudança que resolve.** Apagar vale mais que acrescentar.
5. **Usar pronto ou construir?** Compare o custo de manter dos dois. Dependência nova só com aprovação do humano.
6. **Só então construir**, o mais simples possível, sem abstração antes do segundo uso real.

## Limites (obrigatórios)
- A preguiça **nunca** vale para verificação, teste, segurança, documentação nem decisão de domínio.
- Minimize o **custo total de manter**, não o esforço de hoje. Solução simples que cria dívida perde para uma um pouco maior que não cria.
- Considere a **reversibilidade**: decisão barata de reverter, decida por padrão e registre; difícil de reverter, pergunte (e vira ADR).

## Decisão de domínio versus técnica
- **Domínio** (regra de negócio, o que o produto deve fazer, números de limite): só o humano decide. Pergunte; nunca presuma nem sugira número sem base.
- **Técnica** (arquitetura, estrutura, estratégia de testes): recomende **UMA** opção, com 2 alternativas, trade-offs, reversibilidade e o custo de mudar depois. O humano aprova.
- Antes de recomendar, confira contra `docs/domain.md`, os ADRs e o `AGENTS.md`; se contradisser algo existente, aponte o conflito.

## Economia de tokens
- Contexto enxuto: leia só o trecho que precisa; não releia arquivo grande.
- Pesquisa ruidosa vai para subagente, que devolve só o resumo.
- Uma sessão por tarefa.

## Saída
Uma linha no plano (seção "Menor esforço"):
`Menor esforço: considerei <alternativas>; escolhi <X> porque <motivo>.`
