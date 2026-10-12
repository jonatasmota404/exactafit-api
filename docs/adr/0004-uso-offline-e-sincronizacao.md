# ADR 0004 — Uso offline e sincronização

- **Status:** aceito (implementação ainda não planejada)
- **Data:** 2026-10-12
- **Autor:** Jônatas Júnior

## Contexto
Na academia o sinal pode faltar. Hoje a API gera os ids, o início da sessão é `now()` do servidor (S1) e cada usuário pode ter no máximo uma sessão aberta (S3). Nada disso funciona com registro offline e envio depois. O produto tem multiusuário desde o V1 e um mesmo usuário pode ter mais de um aparelho.

## Decisão
- O V1 funciona offline **só para registrar o treino**: abrir sessão e lançar séries numa ficha que já estava no aparelho. Fichas e catálogo são só leitura offline.
- O sincronismo vai do aparelho para a API (sessões e séries). Os ids de sessão e série são gerados no cliente, e o envio pode repetir sem duplicar.
- O aparelho envia `startedAt` e `finishedAt`; a API aceita as datas sem validar. Datas em UTC.
- **Exceção de S3 só para o sincronismo:** se chegarem várias sessões abertas do mesmo usuário, a API as aceita, mantém aberta a de `startedAt` mais recente e encerra as demais com `finishedAt = startedAt`.
- S4 (ficha sem itens não inicia sessão) vale só ao iniciar online; o sincronismo aceita a sessão.
- Série em conflito de número (S8) não derruba o lote.

## Alternativas descartadas
- **V1 exige internet:** sem sinal o usuário não registra a série.
- **Também editar fichas e exercícios offline:** exige sincronismo nos dois sentidos e regra de conflito de edição (F8 troca os itens por ids novos).
- **Critério "última a chegar" para a sessão aberta:** uma sessão esquecida aberta, enviada tarde, encerraria a sessão de hoje. Foi a primeira escolha e foi revisada no mesmo dia.
- **Recusar a segunda sessão aberta (409):** perde um treino que já aconteceu.

## Consequências
- **Positivas:** o treino na academia não depende de sinal.
- **Negativas / custos:** endpoint de sincronismo novo; ids no cliente; S3 deixa de ser recusa e vira regra de encerramento; a API confia no relógio do aparelho (treino no futuro ou duração negativa possíveis); o token dura 7 dias sem refresh (U6), então um aparelho que fique mais de 7 dias sem enviar precisa de novo login antes.
- **O que passa a ser obrigatório:** o envio do sincronismo é idempotente por id. Nenhuma regra nova pode depender de a API gerar o id de sessão ou série.
- **Em aberto (`TODO(humano)`):** formato do endpoint de sincronismo; como o aparelho lida com a resposta de uma sessão encerrada automaticamente.
- Regras: `docs/domain.md` S1, S3, S4, S5, S8 e bloco (a).
