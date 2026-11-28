# ADR 0016 — Contrato do `POST /sync` e uma sessão aberta por usuário no banco

- **Status:** aceito
- **Data:** 2026-11-25
- **Autor:** Jônatas Júnior

## Contexto
O [ADR 0004](0004-uso-offline-e-sincronizacao.md) decidiu que o treino funciona offline e que o envio pode se repetir sem duplicar, mas deixou o formato do endpoint de sincronismo para o plano. O [ADR 0015](0015-registro-de-refeicao-offline.md) estendeu o offline ao registro de refeição. A regra "uma sessão aberta por usuário" (S3) era conferida só no service do `POST /sessions`: dois aparelhos ao mesmo tempo podiam abrir duas sessões. A exceção de S3 para o sincronismo (fica a de `startedAt` mais recente) não estava implementada. Plano: `docs/plans/2026-11-25-sincronismo.md` (removido no PR que fecha a tarefa 17; ver o histórico do git).

## Decisão

### Escopo do lote
- `POST /sync` autenticado só **cria**: sessões, séries e registros de refeição (os registros entram no PR 17b).
- Corrigir e apagar continuam pelas rotas individuais.

### Corpo
- O corpo é `{ sessions?, sets?, mealLogs? }`, com o limite de 100 KB do Express (413 acima disso) e sem teto de itens.
- Corpo que não é objeto, campo de topo desconhecido ou lista que não é array → 400 do lote inteiro.
- Cada item é validado sozinho, com os DTOs das rotas individuais e as diferenças abaixo:
  - a sessão aceita `finishedAt`, e `null` vale como ausente;
  - a série traz `sessionId` (UUID).

### Resposta
- 200 com `{ sessions, sets, mealLogs, autoClosedSessionIds }`.
- Cada lista vem na ordem enviada, com itens `{ id, status, error? }`.
- `status` vale `created`, `existing`, `closed` (sessão aberta encerrada pelo `finishedAt` do lote) ou `error`.
- `error = { statusCode, message }`, com o mesmo código e a mesma mensagem da rota individual. No 400 de formato, `message` é a lista de textos do ValidationPipe.
- O sucesso não devolve o registro.

### `id` repetido e item inválido
- `id` repetido no mesmo lote, comparado em minúsculas: só a primeira ocorrência é processada. As outras recebem `existing`, ou o mesmo `error` da primeira.
- Um item que não é objeto dá `error` 400 com `id: null`.

### Sessões
- A fase de sessões roda numa transação que trava a linha do usuário (`FOR NO KEY UPDATE`).
- Todas as checagens vêm antes de qualquer escrita.
- A vencedora de S3 é escolhida entre as abertas do servidor e as do lote, por `startedAt` e `id` decrescentes.
- Ordem de escrita:
  1. os encerramentos pedidos pelo lote;
  2. as perdedoras do servidor;
  3. as perdedoras do lote, que já nascem encerradas;
  4. as que vieram encerradas;
  5. a vencedora, por último.
- Assim nunca há duas abertas ao mesmo tempo, e o índice não é violado.

### Encerrar pelo lote
- Sessão aberta no servidor + `finishedAt` no lote → encerra.
- Sessão já encerrada → nada muda: vale o primeiro encerramento, e a sessão não reabre (S9).

### Séries e registros
- São processados depois das sessões, item a item, com a lógica das rotas individuais.
- Erros conhecidos (400, 404, 409, 410) viram item `error`.
- Um erro inesperado dá 500 no lote. O reenvio é idempotente.

### S3 no banco
- O índice único parcial `workout_sessions_one_open_per_user` (`user_id` onde `finished_at IS NULL`) é declarado no schema com o preview `partialIndexes` do Prisma 7, para não virar drift.
- A migration roda numa transação explícita com `LOCK TABLE`: encerra as abertas excedentes pela regra de S3 e depois cria o índice.
- O `POST /sessions` online também trava a linha do usuário. Ele refaz a busca pelo `id` dentro da trava, de modo que o reenvio concorrente continua dando 200. Em `P2002`, relê fora da transação: se a sessão existe, é reenvio; se não, 409 "Já existe uma sessão aberta".

## Alternativas descartadas
- **Lote tudo-ou-nada:** um item ruim travaria o envio de todos os outros e contradiz S8 ("série em conflito não derruba o lote").
- **Fila de operações (corrigir e apagar offline):** exige regra de conflito entre aparelhos. Fica para quando houver necessidade.
- **Índice só no SQL da migration:** o Prisma o veria como drift e proporia apagá-lo (motivo que barrou o índice na tarefa 7a).
- **Gravar a sessão do lote e depois encerrar a do servidor:** o índice não é adiável (`DEFERRABLE`), e o `INSERT` falharia antes.
- **Empate de `startedAt` decidido pela ordem de chegada ou a favor do servidor:** o resultado dependeria da ordem de envio. O maior `id` é determinístico (decisão do humano).

## Consequências
- **Positivas:**
  - "no máximo uma aberta" vale com qualquer número de aparelhos;
  - o mesmo lote pode ser reenviado sem efeito;
  - o aparelho sabe quais sessões foram encerradas automaticamente (`autoClosedSessionIds`).
- **Negativas / custos:**
  - o preview `partialIndexes` pode mudar de sintaxe numa atualização do Prisma (o `prisma validate` e o `prisma generate` do CI acusam);
  - a migration encerra com duração zero as abertas excedentes que já existiam;
  - durante o rolling update (ADR 0010), a versão antiga do `POST /sessions` pode dar 500 numa corrida (passageiro);
  - um lote grande segura a trava do usuário durante a fase de sessões.
- **O que passa a ser obrigatório:**
  - toda rota que abra sessão trava a linha do usuário antes de conferir a aberta;
  - nenhuma consulta pode tratar `userId` como chave única de `WorkoutSession` (o índice é parcial). Verificado em 2026-11-25: com o `@@unique` parcial, o client gerado aceita `userId` em `WorkoutSessionWhereUniqueInput` (`findUnique`, `upsert`, `update`), e o tipo não impede o uso errado. Use `findFirst` com `finishedAt: null`;
  - antes do deploy, backup e lista das sessões que a migration vai encerrar (Validação do humano do plano).
- **Em aberto:** como o app mostra a sessão encerrada automaticamente (`TODO(humano)` do ADR 0004, agora do front).
- Regras: `docs/domain.md` bloco (a), S3, S4 e S8.
