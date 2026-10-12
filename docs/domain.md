# Domínio — exactafit-api

> Fonte da verdade para regras de negócio. Agentes **não devem presumir** regras que não estão aqui; na dúvida, perguntar.
> Preencha as seções; as perguntas guia podem ser apagadas depois de respondidas.

## Visão do produto
<!-- Quem usa? Que problema resolve? O que está fora do produto? -->
- `TODO(humano)`

## Glossário
| Termo | Definição | Nome no código |
|---|---|---|
| Exercício | `TODO(humano)` | `Exercise` |
| Ficha de treino | `TODO(humano)` | `WorkoutRoutine` |
| Item da ficha | `TODO(humano)` | `RoutineItem` |
| Sessão de treino | `TODO(humano)` | `WorkoutSession` |
| Série registrada | `TODO(humano)` | `SetLog` |
| Grupo muscular | `TODO(humano)` | `Exercise.muscleGroup` |
| Tipo de exercício | `TODO(humano)` (hoje só `strength` como padrão) | `Exercise.type` |

## Regras de negócio

### Usuários e acesso
<!-- Perguntas guia:
- Existem papéis (aluno, personal, admin)? Quem pode ver dados de quem?
- Um personal pode montar fichas para alunos?
- Regras de senha (tamanho mínimo, complexidade)? Expiração de sessão?
-->

### Exercícios
<!-- Perguntas guia:
- O catálogo é global, por usuário ou ambos?
- Quem pode criar, editar e remover exercícios?
- Quais valores são válidos para `type` e `muscleGroup`? Lista fechada?
- Remover um exercício usado em fichas/histórico deve ser permitido? O que acontece com o histórico?
-->

### Fichas de treino
<!-- Perguntas guia:
- Limite de fichas por usuário? De itens por ficha?
- `order` precisa ser único e sequencial dentro da ficha?
- Faixas válidas para `targetSets` e `targetReps` (mín./máx.)?
- O mesmo exercício pode aparecer duas vezes na ficha?
- Editar a ficha afeta sessões já realizadas?
-->

### Sessões e séries
<!-- Perguntas guia:
- Uma sessão tem fim (`finishedAt`)? Pode haver duas sessões abertas ao mesmo tempo?
- Pode registrar série de exercício que não está na ficha da sessão?
- Faixas válidas para `weightKg` (0? negativo? decimais?) e `repsCompleted`?
- `setNumber` é sequencial por exercício? Pode editar ou apagar série registrada?
- O que significa `failed`: falha muscular ou série não concluída?
-->

### Progressão e métricas
<!-- Perguntas guia:
- O app calcula progressão de carga, volume ou 1RM? Com que fórmula?
- Unidades: só kg? Fuso horário das datas?
-->

## Invariantes (devem sempre ser verdade)
<!-- Ex.: "Um usuário nunca acessa ficha de outro usuário." Liste as que já valem e as desejadas. -->
- Um usuário só lê e altera as próprias fichas (implementado: filtro por `userId`).
- `TODO(humano)`

## Casos de borda conhecidos
- `TODO(humano)`
