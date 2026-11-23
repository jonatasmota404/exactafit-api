# ADR 0015 — Registro de refeição offline e exclusão com marcador

- **Status:** aceito
- **Data:** 2026-11-23
- **Autor:** Jônatas Júnior

## Contexto
O [ADR 0004](0004-uso-offline-e-sincronizacao.md) limitou o offline ao registro do treino. O registro de refeição (tarefa 13) é feito na hora de comer, muitas vezes sem sinal, e o usuário precisa corrigir e apagar o que lançou errado. O histórico não pode mudar quando o alimento ou o plano mudam (invariante 16), e um aparelho antigo não pode ressuscitar um registro apagado.

## Decisão
- **R1:** o registro de refeição funciona offline. O `id` é gerado no aparelho e o reenvio não duplica, com o contrato do [ADR 0013](0013-idempotencia-por-id-do-cliente.md): mesmo usuário → 200 com o original, sem alterar; outro usuário → 409 sem dados; corrida de dois envios resolvida pelo `P2002` e pela releitura fora da transação.
- **R4:** o usuário pode corrigir (`PUT`) e apagar (`DELETE`) o registro. O registro apagado fica marcado por dentro (`deleted_at`, tarefa 13b), e o reenvio do mesmo `id` pelo dono dá **410**, sem recriar; por outro usuário continua 409. A sessão de treino continua sem exclusão (S9).
- Histórico sem cascata: `meal_log_items.meal_log_id` e `meal_logs.user_id` são `RESTRICT`; as referências a alimento, refeição e refeição modelo são `SET NULL`, com o nome e os macros copiados.
- **Revisão do alcance do ADR 0004:** o offline passa a incluir o registro de refeição. O lote `POST /sync` continua na tarefa 17.

## Alternativas descartadas
- **Id gerado no servidor:** quebra o registro offline e duplica no reenvio.
- **Apagar de verdade o registro:** um aparelho antigo reenviaria o `POST` e ressuscitaria o registro.
- **`CASCADE` nas referências:** apagar o plano ou o alimento apagaria o histórico.

## Consequências
- **Positivas:** reenviar é seguro; o histórico sobrevive a mudanças no plano e nos alimentos.
- **Negativas / custos:** o 409 revela que um UUID existe (risco desprezível com UUID aleatório, como no ADR 0013); registros apagados ficam no banco; a exclusão de conta precisa apagar itens → registros → usuário, nessa ordem.
- **O que passa a ser obrigatório:** o cliente gera o `id` e envia `eatenAt` com fuso; a transação do `create` trava refeição, refeição modelo e alimentos, nessa ordem, sem travar o plano.
- Regras: `docs/domain.md` R1–R6, C1 e C3.
