# Plano de risco: progressão e desempenho anterior (tarefa 8)

> Tarefa 8 de `docs/produto.md`, critério 6 da Fase 1. O `produto.md` classifica esta tarefa como risco médio. Ela muda o schema (campos novos no item do treino, com migration), então sobe para **alto** (`AGENTS.md`: migrations).

Aprovado por: humano em 2026-11-11 (inclui as regras P1 a P10)
Revisão do plano: APROVADO em 2026-11-11 (3ª rodada; as pendências da 1ª e da 2ª foram aplicadas)

## Decisões do humano (2026-11-11, nesta conversa)
- **Onde fica a regra:** no **item do treino** (`WorkoutItem`), não numa tabela `ProgressionRule` por exercício. Assim o mesmo exercício pode progredir de formas diferentes em treinos diferentes. Isso revisa o texto "por exercício" da decisão (d).
- **Tipos de regra:** dupla, linear ou nenhuma.
- **Passo %:** escolhido no item, de 1 a 10, de 0,5 em 0,5. O intervalo "2 a 5%" do `domain.md` fica como sugestão para os modelos, não como trava.
- **Carga anterior:** as séries do exercício na **última sessão encerrada** (a de `startedAt` mais recente) que tem série dele, em qualquer treino do usuário. A sessão em andamento fica de fora.
- **Base e séries que contam:** a base é a **maior carga** usada nessa sessão. Só contam as séries com essa carga; as mais leves são tratadas como aquecimento.
- **Dupla:** sobe quando as séries que contam são pelo menos `targetSets`, todas chegaram ao **máximo** da faixa e nenhuma foi marcada como falha.
- **Linear:** sobe quando as séries que contam são pelo menos `targetSets`, todas chegaram ao **mínimo** da faixa e nenhuma foi marcada como falha.
- **Quando não sobe:** a sugestão é repetir a carga base.
- **Arredondamento:** para baixo, em múltiplo de 0,5 kg. Se o valor arredondado ficar ≤ base, a sugestão é o **próximo múltiplo de 0,5 acima da base**. Exemplos: 10 + 1% dá 10,5; 10,3 + 1% dá 10,5. A sugestão fica sempre em múltiplo de 0,5 kg, exceto quando bate no teto. (Revisão de 2026-11-11, depois do `revisor-de-plano`.)
- **Teto:** a sugestão nunca passa de 9.999,99 kg, que é o máximo que a série aceita (S7). Quando o teto ou a base impedem a subida, `increase` é `false`.
- **Carga 0 kg conta como sem carga:** se a maior carga for 0, não há sugestão. Isso vale para quem treina só com o peso do corpo.
- **Item por tempo, ou sem carga registrada:** a rota mostra o desempenho anterior, mas sem sugestão de carga.

## Regras de negócio propostas pelo agente (o humano aprova junto com o plano; entram na decisão (d) de `docs/domain.md`)
- **P1. Campos do item:**
  - `progressionType` é `NONE`, `DOUBLE` ou `LINEAR`, com padrão `NONE`;
  - `progressionStepPercent` vai de 1 a 10, de 0,5 em 0,5.
- **P2. Coerência do item:**
  - `DOUBLE` e `LINEAR` exigem `progressionStepPercent` **e** a faixa de repetições (`targetRepsMin`/`Max`), porque a regra compara repetições;
  - `NONE` com passo informado dá 400;
  - `null` em `progressionType` dá 400; `null` no passo equivale a não mandar (R8 da tarefa 7b).
- **P3. Linear e `targetSets`:** a linear exige pelo menos `targetSets` séries que contam, como a dupla, por coerência entre as duas regras.
- **P4. Repetições não registradas:** uma série que conta com `repsCompleted` nulo é tratada como "não chegou" à faixa.
- **P7. Séries sem carga e aquecimento:**
  - séries com `weightKg` nulo ficam fora das séries que contam, mesmo misturadas com séries com carga;
  - uma série **mais leve** com `failed: true` é aquecimento e não impede a subida.
- **P8. Desempate da "última sessão":** a ordem é `startedAt` decrescente, depois `finishedAt` decrescente e por fim `id` decrescente.
- **P9. Efeito de F8:** o `PUT /workouts` com `items` recria os itens com ids novos. Um `workoutItemId` antigo, guardado pelo app inclusive offline, passa a dar 404 "Item não encontrado". O front precisa recarregar o treino depois de editar.
- **P10. Mesmo exercício em dois itens do treino (F5):** as séries da sessão se misturam. A base continua sendo a maior carga, e `targetSets` é o do item consultado.
- **P5. Rota:** `GET /exercises/:id/last-performance?workoutItemId=<uuid>`.
  - O `workoutItemId` é opcional. Sem ele, a resposta traz o desempenho anterior e `suggestion: null`.
  - Exercício inexistente ou de outro usuário dá 404 "Exercício não encontrado", como em S8.
  - Um item que não é de um treino do usuário dá 404 "Item não encontrado".
  - Um item de outro exercício dá 400 "Item não é deste exercício".
- **P6. Resposta:**
  ```
  {
    exerciseId,
    session: { id, startedAt, finishedAt } | null,
    sets: [ { setNumber, weightKg, repsCompleted, durationSeconds, failed } ],
    suggestion: { weightKg: "61.5", increase: true, rule: "DOUBLE" } | null
  }
  ```
  - `sets` vem em ordem de `setNumber`.
  - `weightKg` volta como texto, igual à série.
  - Sem sessão anterior: `session: null`, `sets: []` e `suggestion: null`.

## Decisões técnicas do agente (para o revisor conferir)
- **Cálculo da sugestão:** uma função pura em `src/exercises/progression.ts`, com teste unitário (`progression.spec.ts`).
  - Entrada: as séries, a regra do item, o passo, a faixa e `targetSets`.
  - Saída: `{ weightKg, increase }` ou `null`.
  - A conta é feita em inteiros, sem ponto flutuante:
    - a carga `Decimal` vira centésimos com `weightKg.mul(100).toNumber()`, que é exato em `Decimal(6,2)`. Nunca `Number(weightKg) * 100`, porque `0.29 * 100` dá `28.999…`;
    - o passo vira décimos com `step.mul(10).toNumber()`;
    - candidato = `Math.floor(cent * (1000 + passoDecimos) / 50000) * 50`, com divisão inteira por `Math.floor` (o maior valor intermediário fica em torno de 1,1e9, longe de 2^53);
    - se candidato ≤ base, candidato = `(Math.floor(cent / 50) + 1) * 50`;
    - por fim, `Math.min(candidato, 999999)`.
  - A saída vira texto com `new Prisma.Decimal(cent).div(100).toString()`, no mesmo formato das séries: `"60"`, `"61.5"` e `"9999.99"`.
- **Migration à mão**, só com acréscimos:
  - `CREATE TYPE "ProgressionType"`;
  - `ADD COLUMN progression_type "ProgressionType" NOT NULL DEFAULT 'NONE'`;
  - `ADD COLUMN progression_step_percent DECIMAL(3,1)`.

  Conferência: `npx prisma migrate diff --from-config-datasource --to-schema prisma/schema.prisma --exit-code`, com exit 0.
- **Consulta:**
  - a última `WorkoutSession` com `userId` do token e `finishedAt` preenchido que tem `SetLog` do exercício, em ordem de `startedAt` decrescente, `finishedAt` decrescente e `id` decrescente (P8);
  - depois, as séries dela daquele exercício;
  - tudo filtrado por `userId`.
- **Gravação dos campos novos:** o item recebe os campos no `POST` e no `PUT /workouts`, pelo mesmo DTO e com a mesma validação da 7b.

## Critérios de aceite
Arquivos de teste:
- `test/progression.e2e-spec.ts` (novo);
- `src/exercises/progression.spec.ts` (unitário, novo).

**Campos do item** (`POST`/`PUT /workouts`)
- [ ] **C1: campos aceitos e devolvidos.** Um item `DOUBLE` com passo 2.5 e faixa 8–12 dá 201. O `GET` devolve `progressionType: "DOUBLE"` e `progressionStepPercent: "2.5"`. Sem os campos, o item volta com `NONE` e `null`. — teste: "campos de progressão no item".
- [ ] **C2: coerência dá 400.** No `POST` e no `PUT`, cada um destes casos dá 400:
  - `DOUBLE` sem passo;
  - `LINEAR` sem faixa (item só com duração);
  - `NONE` com passo;
  - passo 0.5, 10.5 ou 2.3;
  - `progressionType` inválido;
  - `progressionType: null`.

  Bordas que dão 201: passo 1, 10 e 9.5.

  — teste: "coerência da progressão" (`it.each`).

**Desempenho anterior** (`GET /exercises/:id/last-performance`)
- [ ] **C3: rota exige token.** Sem token dá 401. — teste: "sem token dá 401".
- [ ] **C4: sem histórico.** Um exercício nunca registrado dá 200 com `session: null`, `sets: []` e `suggestion: null`. — teste: "sem histórico".
- [ ] **C5: última sessão encerrada.** O usuário tem estas sessões:
  - S1, encerrada, de 01/11;
  - S2, encerrada, de 05/11, com séries noutro treino;
  - S3, aberta, de 10/11, com o exercício;
  - S4, encerrada, de 07/11, **sem** série do exercício.

  A rota devolve as séries de **S2** em ordem de `setNumber`, com `weightKg` em texto.

  **Desempate (P8):** duas sessões encerradas com o mesmo `startedAt` e `finishedAt` diferentes. Vale a de `finishedAt` maior.

  — testes: "última sessão encerrada, em qualquer treino" e "desempate por finishedAt".
- [ ] **C6: isolamento.**
  - As séries de outro usuário com o mesmo exercício (de catálogo) não aparecem.
  - Exercício inexistente ou próprio de outro usuário dá 404 "Exercício não encontrado".
  - Id que não é UUID dá 400.
  - `workoutItemId` de treino alheio, ou inexistente, dá 404 "Item não encontrado".
  - `workoutItemId=abc`, que não é UUID, dá 400.
  - Item de outro exercício dá 400.

  — teste: "isolamento".
- [ ] **C7: sugestão dupla (e2e).** Item `DOUBLE`, passo 2.5, faixa 8–12, `targetSets` 3. Na última sessão: 40×15, 60×12, 60×12, 60×12, nenhuma com falha.
  - Resultado: `suggestion: { weightKg: "61.5", increase: true, rule: "DOUBLE" }`.
  - Com 60×12, 60×11, 60×12, o resultado é `{ weightKg: "60", increase: false }`.

  — teste: "dupla sobe e repete".
- [ ] **C8: regras da sugestão (unitário, função pura).**
  - **Dupla:**
    - sobe só com pelo menos `targetSets` séries na maior carga, todas ≥ máximo e sem falha;
    - repete se uma série tem falha;
    - repete se fez menos séries que `targetSets`;
    - repete se `repsCompleted` é nulo.
  - **Linear:**
    - sobe com todas ≥ mínimo e sem falha;
    - repete com uma abaixo do mínimo.
  - **Base:** as séries mais leves são ignoradas.
  - **Arredondamento:**
    - 60 kg + 2,5% = 61,5 kg;
    - 61,25 kg + 2,5% = 62,78 kg, que arredonda para baixo e dá 62,5 kg;
    - 10 kg + 1% = 10,1 kg. O arredondamento dá 10 kg, que não passa da base, então a sugestão vira o próximo múltiplo acima: 10,5 kg;
    - 10,3 kg + 1% = 10,403 kg. O arredondamento dá 10 kg, abaixo da base, então a sugestão é 10,5 kg;
    - 60,29 kg + 1% = 60,89 kg, que arredonda para 60,5 kg. Esse caso confere a conversão do `Decimal` sem float;
    - 9999,99 kg + 10% fica no teto: `"9999.99"`, com `increase: false`.
  - **Séries que contam (P7):**
    - séries com `weightKg` nulo misturadas com outras não contam e não impedem a subida;
    - uma série mais leve com `failed: true` não impede a subida.
  - **Sem sugestão** (`null`):
    - `NONE`;
    - nenhuma série com carga;
    - maior carga igual a 0;
    - item sem faixa.

  — teste: um caso por linha em `progression.spec.ts`.
- [ ] **C9: sem item, sem sugestão.** A mesma situação do C7 sem `workoutItemId` devolve as séries e `suggestion: null`. — teste: "sem workoutItemId não sugere".
- [ ] **C10: dados preservados pela migration.** Os itens existentes ficam com `progression_type = NONE` e `progression_step_percent` nulo, e a contagem de `workout_items` é a mesma antes e depois. Verificado por comando (`SELECT`, mais o `migrate diff` com exit 0), com as saídas no PR.

Fora de escopo:
- progressão por tempo ou por repetições sem carga;
- semana leve e fases (Fase 4);
- tabela `ProgressionRule`;
- sugestão automática gravada (a sugestão é só calculada e mostrada; o usuário decide);
- tipo de série no `SetLog`.

## Risco
- **Zona tocada:**
  - `prisma/schema.prisma`;
  - `prisma/migrations/<nova>`.
- **Código:**
  - `src/exercises/`: controller, service, `progression.ts` e o teste unitário;
  - `src/workouts/`: DTO e service.
- **Testes:** `test/progression.e2e-spec.ts`.
- **Docs:**
  - `docs/domain.md`: decisão (d), que passa a ter a regra no item, além de P1 a P10, do teto de 9999,99 kg, da carga 0 como sem carga e do arredondamento para o próximo múltiplo de 0,5; mais a linha do glossário, se houver;
  - `docs/produto.md`: tarefa 8 feita, e a linha da tabela da tarefa 8 deixa de citar `ProgressionRule`; a seção 4 tira `ProgressionRule`, citando a decisão; o critério 6 da Fase 1 passa de "+2 a 5%" para "passo do item, de 1 a 10%".
- **Como desfazer:**
  - antes do merge, fechar o PR;
  - depois do merge, abrir um PR que reverte o código e acrescenta uma migration inversa, nesta ordem:
    1. `ALTER TABLE workout_items DROP COLUMN progression_step_percent, DROP COLUMN progression_type;`
    2. `DROP TYPE "ProgressionType";`

  Ao desfazer, perde-se só a configuração de progressão dos itens. Nenhum histórico depende dela.
- **Pré-mortem:**
  1. Uma sugestão errada leva a carga demais. Mitigação: função pura testada caso a caso, conta em inteiros e arredondamento para baixo. A sugestão é só exibida; o usuário decide.
  2. Vazamento de histórico de outro usuário num exercício de catálogo compartilhado. Mitigação: filtro por `userId` da sessão, coberto pelo C6.
  3. A sessão aberta usada como "anterior" mostra o treino de hoje pela metade. Mitigação: só sessões encerradas, coberto pelo C5.
  4. A migration perde ou trava dados. Mitigação: só `ADD COLUMN` com padrão, coberto pelo C10.
- **Segurança** (skill `seguranca`, API):
  - **Controle de acesso:** se aplica (histórico é dado do usuário; exercício de catálogo é compartilhado). Verificado pelo C6 e pela revisão de `userId` em toda query.
  - **Validação de entrada:** se aplica (campos novos do item e query string). Verificado por C2 e C6, com `ParseUUIDPipe` no `:id` e no `workoutItemId`.
  - **Dados pessoais:** a carga e as repetições de treino não são os dados sensíveis listados (peso, medidas, fotos, ciclo). Ainda assim ficam isoladas por usuário.
  - **Autenticação, segredos e dependências:** não se aplicam.
- **Dependências novas:** Nenhuma.

## Validação do humano
**0. Conferência da migration.** Antes de tudo, `GET /workouts` mostra os itens que você já tinha com `progressionType: "NONE"`. Faça isso depois de `npx prisma migrate deploy` e com o app no ar.

Depois, com um token e o id de um exercício:

1. Crie um treino com o item `{"exerciseId":"<id>","order":1,"targetSets":3,"targetRepsMin":8,"targetRepsMax":12,"progressionType":"DOUBLE","progressionStepPercent":2.5}`. Anote o id do item.
2. Registre uma sessão desse treino. Se houver uma sessão sua aberta, encerre-a antes, senão a abertura dá 409 (S3).
   - **Abrir:** `POST /sessions` com `{"id":"<uuid novo>","workoutId":"<treino>","startedAt":"2026-11-11T10:00:00-03:00"}`.
   - **Séries:** 4 vezes `POST /sessions/<sessão>/sets`, com um `<uuid novo>` em cada:
     - `{"id":"<uuid novo>","exerciseId":"<id>","setNumber":1,"weightKg":40,"repsCompleted":15}`;
     - `{"id":"<uuid novo>","exerciseId":"<id>","setNumber":2,"weightKg":60,"repsCompleted":12}`;
     - `{"id":"<uuid novo>","exerciseId":"<id>","setNumber":3,"weightKg":60,"repsCompleted":12}`;
     - `{"id":"<uuid novo>","exerciseId":"<id>","setNumber":4,"weightKg":60,"repsCompleted":12}`.
   - **Encerrar:** `PATCH /sessions/<sessão>` com `{"finishedAt":"2026-11-11T11:00:00-03:00"}`.
3. Rode `GET /exercises/<id>/last-performance?workoutItemId=<item>`.
   - **Esperado:** as 4 séries e `suggestion.weightKg` igual a `"61.5"`, com `increase: true`.
4. Corrija uma série de 60 kg para 11 repetições (`PATCH /sessions/<sessão>/sets/<série>` com `{"repsCompleted":11}`) e repita o passo 3.
   - **Esperado:** `suggestion.weightKg` igual a `"60"`, com `increase: false`.
5. Rode `GET /exercises/<id>/last-performance` sem o item.
   - **Esperado:** as séries e `suggestion: null`.

- [ ] Rodei o comportamento e ele faz o que os critérios pedem.
