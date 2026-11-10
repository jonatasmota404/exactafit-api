# ADR 0013 — Idempotência do `POST /sessions` pelo id do cliente

- **Status:** aceito
- **Data:** 2026-11-09
- **Autor:** Jônatas Júnior

## Contexto
O [ADR 0004](0004-uso-offline-e-sincronizacao.md) decidiu que os ids de sessão e de série são gerados no aparelho e que o envio pode repetir sem duplicar, mas deixou o contrato para o plano. Até aqui o `POST /sessions` gerava o id no servidor, usava o relógio do servidor em `startedAt` e criava uma sessão nova a cada reenvio (achados A1 e A3 de `docs/plans/2026-10-19-auditoria-sessions.md`). As FKs do log apagavam histórico em cascata (C2, C3).

## Decisão
- `id` (UUID gerado no aparelho) e `startedAt` são **obrigatórios** no `POST /sessions`; sem eles, 400.
- `startedAt` exige data, hora e fuso (`2026-11-09T10:00:00Z` ou `2026-11-09T07:00:00-03:00`). Só data, ou hora sem fuso, dá 400. A API grava em UTC e não valida a faixa (S1).
- **Reenvio:** o mesmo `id` enviado de novo pelo mesmo usuário devolve **200 com a sessão já gravada**, sem alterar nada, mesmo com corpo diferente. Corrigir uma sessão é papel de outra rota (S9).
- `id` de sessão de **outro usuário** dá **409**, sem devolver dados da sessão alheia.
- Ordem das checagens: (1) DTO, 400; (2) busca pelo `id`: do usuário, 200 com a original; de outro, 409; (3) ficha inexistente ou de outro usuário, 404; (4) cria, 201. Se o `create` falhar por unicidade (`P2002`, corrida de dois envios), a API relê pelo `id` e aplica o passo 2.
- As FKs `WorkoutSession.userId`, `WorkoutSession.routineId`, `SetLog.sessionId` e `SetLog.exerciseId` passam de `CASCADE` para `RESTRICT`.

## Alternativas descartadas
- **Reenvio com corpo diferente atualiza a sessão:** mistura criação com correção e deixa um aparelho antigo sobrescrever o que outro corrigiu.
- **Reenvio responde 409:** o aparelho não saberia distinguir "já gravei" de "conflito" e trataria um sucesso como erro.
- **`startedAt` opcional, com o relógio do servidor como reserva:** o registro offline chegaria com a hora do envio, não a do treino.
- **Aceitar hora sem fuso como UTC:** um aparelho em `-03:00` gravaria o treino três horas deslocado sem ninguém perceber.

## Consequências
- **Positivas:** reenviar é seguro; a corrida de dois envios não gera 500 nem duplicata; histórico não some por cascata.
- **Negativas / custos:** o 409 revela que um UUID existe (risco desprezível com UUID aleatório, aceito na auditoria). Com as FKs em `RESTRICT`, apagar ficha ou usuário que tenha sessão, ou exercício que tenha série, falha no banco (`P2003`). Hoje nenhuma rota apaga esses registros; a rota que vier a apagar precisa tratar o erro, em vez de devolver 500.
- **O que passa a ser obrigatório:** o cliente sempre gera o `id` da sessão e envia `startedAt` com fuso. O fluxo de exclusão de conta (C1) e o arquivamento (F9) precisam apagar ou preservar na ordem séries → sessões → fichas → usuário.
- Regras: `docs/domain.md` S1, S2, S5, S7, S8, C2 e C3. Ficam para depois: uma sessão aberta por usuário (S3, tarefa 3), o 409 de série duplicada na rota (S8, tarefa 3) e as FKs `WorkoutRoutine.userId` e `RoutineItem.exerciseId` (tarefa 6).
