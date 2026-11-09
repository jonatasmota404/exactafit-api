# ADR 0012 — Front como PWA offline-first

- **Status:** aceito (repositório do front ainda não existe)
- **Data:** 2026-11-09
- **Autor:** Jônatas Júnior

## Contexto
Não existe front do Exacta Fit. Houve uma decisão anterior, fora deste repositório, por React Native; a consolidação em [`produto.md`](../produto.md) pede PWA. O app precisa funcionar sem rede no registro de treino e no montador de prato, e ser instalável no celular.

## Decisão
O front é um PWA instalável, offline-first, num repositório próprio. A API continua sendo a fonte da verdade; o sincronismo segue o [ADR 0004](0004-uso-offline-e-sincronizacao.md).

## Consequências
- Lembretes por push no iOS só funcionam com o app instalado na tela inicial e permissão dada pelo usuário; no Android funcionam no navegador.
- Cálculos que precisam rodar sem rede (porção do prato) devem ser funções puras que o front também executa.
- Um único código para Android, iPhone e desktop; sem loja de aplicativos.

## Alternativas consideradas
- React Native: acesso nativo melhor a notificações, mas exige build por plataforma e publicação em loja; descartado na consolidação.
