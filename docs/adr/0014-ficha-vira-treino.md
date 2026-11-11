# ADR 0014 — A ficha vira treino; o programa organiza os treinos

- **Status:** aceito
- **Data:** 2026-11-11
- **Autor:** Jônatas Júnior (decisão); implementação pelo agente

## Contexto
O [ADR 0011](0011-app-generico-plano-e-dado.md) previa que `WorkoutRoutine` e `RoutineItem` seriam "absorvidos por `Program`". Ao detalhar a tarefa 6, o humano decidiu o contrário: a ficha atual já é o que o usuário chama de treino (ex.: "Treino A"), e o programa serve para organizá-los num ciclo. Sessões, séries e histórico já apontam para a ficha, e a regra C2/C3 proíbe apagá-los em cascata.

## Decisão
- A ficha vira o treino (`Workout`), e o item da ficha vira o item do treino (`WorkoutItem`). O `Program` só organiza os treinos no ciclo, por meio de `ProgramDay`.
- A migration **renomeia** tabelas, colunas e constraints, sem cópia de dados: as fichas existentes viram treinos fora de programa, e sessões e histórico continuam apontando para os mesmos registros.
- **Troca de contrato da API**, feita agora porque ainda não há front: `/routine` vira `/workouts` (a rota antiga dá 404); na resposta, `routineItems` vira `items`, `routineId` vira `workoutId` e `exercices` vira `exercise`; `POST /sessions` recebe e devolve `workoutId` (`routineId` no body dá 400); as mensagens passam a dizer "Treino não encontrado" e "Treino sem exercícios".
- Cada usuário pode ter vários programas, mas **um programa ativo por vez**: ativar um desativa o anterior, e a tela Hoje usa o ativo. A regra é garantida no service da tarefa 7, não no banco (o Prisma não declara índice parcial).
- `Workout.userId` e `WorkoutItem.exerciseId` passam a `RESTRICT` (C3); `Program.userId` e `ProgramDay.workoutId` são `RESTRICT`, e `ProgramDay.programId` é `CASCADE`.

## Alternativas descartadas
- **Cada ficha virar um programa:** obrigaria mover sessões e histórico para o programa ou mantê-los apontando para um registro que mudou de papel, e misturaria "o que se treina" com "como o ciclo se organiza". Também impediria reutilizar o mesmo treino em dias diferentes.
- **Manter o nome `WorkoutRoutine` e só criar `Program`:** deixaria dois vocabulários (ficha e treino) no código e na API.

## Consequências
- **Positivas:** sem cópia nem risco de perda de dados; o mesmo treino pode aparecer em vários dias e programas; o vocabulário do código acompanha o do produto.
- **Negativas / custos:** quebra do contrato da API (aceitável sem front); migration de risco alto com renames; clientes que usem `/routine` ou `routineId` deixam de funcionar.
- **O que passa a ser obrigatório:** o dono do treino de cada `ProgramDay` e a regra de um programa ativo por usuário são validados no service da tarefa 7. **Altera a consequência do ADR 0011** que dizia que `WorkoutRoutine` e `RoutineItem` seriam "absorvidos por `Program`": eles são renomeados para `Workout` e `WorkoutItem` e o `Program` não os substitui.
