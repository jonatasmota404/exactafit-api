# Plano de risco: CRUD de `/programs` (tarefa 7a)

> Tarefa 7 de `docs/produto.md`, dividida em duas pela regra 6 do `AGENTS.md` (as duas partes juntas passam de ~300 linhas de produção):
> - **7a** (este plano): rotas de `/programs`, ativação e limites do ciclo. Não tem migration: o schema `Program`/`ProgramDay` veio da tarefa 6.
> - **7b** (plano próprio, depois): campos novos do item do treino, com migration.

Aprovado por: humano em 2026-11-11 (inclui as regras R1 a R7)
Revisão do plano: APROVADO em 2026-11-11 (2ª rodada; as 7 pendências da 1ª foram aplicadas)

## Decisões do humano (2026-11-11, nesta conversa)
- **Limites do ciclo:** o semanal tem `cycleDays` = 7 e `weeks` de 1 a 4; o rotativo tem `cycleDays` de 2 a 14 e `weeks` = 1.
- **Remoção:** o programa pode ser apagado (`DELETE`). Os dias saem junto e os treinos ficam (C3). Apagar o programa ativo deixa o usuário sem programa ativo.
- **Ativação:** `POST /programs/:id/activate` ativa este programa e desativa o anterior. `POST /programs/:id/deactivate` deixa o usuário sem programa ativo.
- **Quantidade:** sem teto agora, nem de programas por usuário nem de treinos por dia. Valem só os limites do ciclo.

## Regras de negócio propostas pelo agente (o humano aprova junto com o plano; entram na decisão (d) de `docs/domain.md`)
- **R1. Formato do corpo** (POST e PATCH):
  - campos: `name`, `cycleType`, `cycleDays`, `weeks`, `startDate` e `days`;
  - cada item de `days` tem `week`, `day`, `workoutId` e `order`;
  - `active` não é aceito no corpo e dá 400 pelo `forbidNonWhitelisted`, como nos outros módulos.
- **R2. Padrões só no `POST`:**
  - semanal: `cycleDays` é 7 e `weeks` é 1;
  - rotativo: `weeks` é 1, e `cycleDays` é obrigatório.

  O `PATCH` não completa nada: ele confere o **estado final** (o que já está gravado com o que veio no corpo). Exemplo: um rotativo de 5 dias que recebe `{"cycleType":"WEEKLY"}` sem `cycleDays: 7` dá 400.
- **R3. `days` no `PATCH`:** atualização parcial. Se `days` vier, substitui todos os dias, como F8 faz com os itens do treino. Os dias que ficam precisam caber no `weeks`/`cycleDays` final.
- **R4. `null` no `PATCH`:** dá 400 em qualquer campo, porque nenhum campo do programa é opcional no banco.
- **R5. Programa sem dias é permitido** (rascunho), como F3 faz com o treino.
- **R6. `order`:** inteiro ≥ 0 e único dentro do mesmo (`week`, `day`). Lacunas são permitidas, como em F11.
- **R7. `startDate`:**
  - entra só como data, no formato `AAAA-MM-DD`; outro formato ou data impossível dá 400;
  - volta no **mesmo formato** (`"2026-11-16"`), não como data e hora ISO, para o front não converter o valor por fuso.

## Decisões técnicas do agente (para o revisor conferir)
- **Resposta:** o programa com `days` em ordem de `week`, `day` e `order`. Cada dia traz `workout: { id, name }`, e só isso, para não vazar campos à toa.
- **PATCH em transação:** o programa é lido com `SELECT … FOR UPDATE`. Assim, dois PATCH ao mesmo tempo não validam contra um estado velho. A checagem do treino do dono e a substituição dos dias ficam na mesma transação.
- **Rotas que não respondem 201/200 por padrão:** `@HttpCode(200)` em `activate`/`deactivate` e `@HttpCode(204)` no `DELETE`.
- **Mensagens:**
  - programa inexistente ou de outro usuário: 404 "Programa não encontrado";
  - treino inexistente ou de outro usuário no dia: 400 "Treino não encontrado", sem indicar o dia, como em F6.
- **Um ativo por usuário:** a ativação roda numa transação. Primeiro um `updateMany` põe `active = false` em **todos** os programas do usuário, o que trava essas linhas. Depois ativa o escolhido. Duas ativações ao mesmo tempo ficam em fila nos mesmos locks. Isso é verificado por teste com requisições em paralelo, e não com índice parcial (decisão (d)). Se a ativação do escolhido (`updateMany({ id, userId })`) não alterar nenhuma linha, a função lança 404 **dentro** da transação. Isso desfaz o desligamento, e o ativo de quem pediu continua igual.
- **Isolamento:** toda query filtra por `userId`, e as escritas também (`updateMany`/`deleteMany` com `{ id, userId }`). Isso evita repetir o trade-off 3 de F1.

## Critérios de aceite
Arquivo de teste: `test/programs.e2e-spec.ts` (novo). Todas as rotas exigem token: sem token, 401 (C1).

- [ ] **C1: rotas exigem token.** `GET /programs` sem token dá 401. — teste: "rotas sem token dão 401" (uma chamada por rota: `POST`, `GET`, `GET /:id`, `PATCH /:id`, `DELETE /:id`, `activate` e `deactivate`).
- [ ] **C2: cria semanal com alternância.** `POST /programs` semanal com `weeks: 2` e dias A-B (inclui dois treinos no mesmo dia, com `order` 1 e 2) dá 201:
  - `active: false`, `cycleDays: 7`;
  - `startDate` enviado como `"2026-11-16"` volta exatamente `"2026-11-16"` (R7), também no `GET /programs/:id`;
  - `days` em ordem, cada um com `workout.id` e `workout.name`.

  — teste: "cria semanal A-B".
- [ ] **C3: cria rotativo.** `POST /programs` rotativo com `cycleDays: 5` e dias nas posições 1, 2 e 4 dá 201 com `weeks: 1`. Sem `cycleDays` dá 400. — teste: "cria rotativo de 5 dias" e "rotativo sem cycleDays dá 400".
- [ ] **C4: limites do ciclo dão 400.**
  - semanal com `weeks` 0 ou 5;
  - semanal com `cycleDays` diferente de 7;
  - rotativo com `cycleDays` 1 ou 15;
  - rotativo com `weeks` 2;
  - dia com `week` fora de 1..weeks, ou `day` fora de 1..cycleDays (8 no semanal, 6 num rotativo de 5);
  - `order` negativo;
  - `order` repetido no mesmo (`week`, `day`).

  — teste: um caso por linha, em "limites do ciclo".
- [ ] **C5: validação de campos dá 400.**
  - `name` ausente, vazio ou com mais de 100 caracteres;
  - `cycleType` fora de `WEEKLY`/`ROTATING`;
  - `startDate` ausente, `2026-02-30` ou `2026-11-02T10:00:00Z`;
  - `workoutId` que não é UUID;
  - campo `active` no corpo;
  - no `PATCH`, `null` em `name`, `cycleType`, `cycleDays`, `weeks`, `startDate` ou `days` dá 400, e o programa continua igual no `GET` (R4).

  — teste: "validação de campos" e "PATCH com null dá 400".
- [ ] **C6: dia só aponta para treino do dono.** No `POST` e no `PATCH`, um dia com treino de outro usuário dá 400 "Treino não encontrado", e um treino inexistente dá a mesma resposta. Nada é gravado. — teste: "treino de outro usuário dá 400", que também confere que nenhum programa foi criado e que os dias do programa editado ficaram iguais.
- [ ] **C7: lista e lê só os próprios.**
  - `GET /programs` devolve só os programas do usuário do token, com `days`;
  - `GET /programs/:id` de outro usuário, ou com id inexistente, dá 404 "Programa não encontrado";
  - id que não é UUID dá 400.

  — teste: "isolamento na leitura".
- [ ] **C8: edição parcial.** O `PATCH /programs/:id`:
  - com só `name`, muda o nome e mantém os dias;
  - com `days`, substitui todos os dias;
  - reduzindo `weeks` de 2 para 1 sem mandar `days`, quando há dia na semana 2, dá 400 e nada muda;
  - trocando o tipo sem completar os campos (R2): num rotativo de 5 dias, `{"cycleType":"WEEKLY"}` dá 400, e `{"cycleType":"WEEKLY","cycleDays":7}` dá 200;
  - em programa de outro usuário, dá 404 e nada muda.

  — teste: "edição parcial", "estado final fora do limite dá 400", "trocar o tipo não completa campos" e "PATCH de outro usuário dá 404".
- [ ] **C9: apaga.**
  - `DELETE /programs/:id` dá 204 e leva os dias, mas os treinos continuam em `GET /workouts`;
  - de outro usuário, dá 404 e o programa continua lá;
  - apagar o programa ativo deixa o usuário sem programa ativo.

  — teste: "apaga e mantém treinos" (apaga o programa **ativo** e confere zero ativos por SQL) e "DELETE de outro usuário dá 404".
- [ ] **C10: ativa e desativa.**
  - `POST /programs/:id/activate` dá 200 com `active: true`, e o programa que estava ativo passa a `false` (conferido no `GET /programs`);
  - ativar o já ativo dá 200 sem mudança;
  - `POST /programs/:id/deactivate` dá 200 com `active: false`, e o usuário fica com zero ativos;
  - quando A ativa ou desativa o programa de B, ou um id inexistente, dá 404; o programa ativo de A e o de B continuam os mesmos.

  — teste: "ativar troca o ativo", "desativar deixa sem ativo" e "activate de outro usuário ou inexistente dá 404 sem mudar nenhum ativo".
- [ ] **C11: um ativo mesmo com pedidos simultâneos.** 10 `activate` em paralelo, alternando entre 2 programas do mesmo usuário, respondem **todos 200** e deixam exatamente 1 ativo. Conferido por SQL, com `count(*) WHERE active`. — teste: "ativações em paralelo deixam 1 ativo".
- [ ] **C12: ativar não afeta outro usuário.** O ativo do usuário B continua ativo quando A ativa um programa. — teste: incluído em "ativar troca o ativo".

Fora de escopo:
- os campos novos do item do treino (7b);
- a semana e o dia vigentes a partir de `startDate` (é o `GET /today`, tarefa 15);
- um teto de programas ou de treinos por dia;
- um índice parcial no banco;
- arquivar programa;
- copiar programa.

## Risco
- **Zona tocada:** nenhuma da lista do `AGENTS.md`.
  - **Código novo:**
    - `src/programs/` (controller, service, DTOs e módulo);
    - `src/app.module.ts`.
  - **Testes:** `test/programs.e2e-spec.ts`.
  - **Docs:**
    - `docs/domain.md`: decisão (d) com os limites, a remoção, a ativação e as regras R1 a R7; glossário;
    - `docs/produto.md`: a tarefa 7 vira 7a e 7b.
  - **Fora:** schema e migrations não mudam.

  O risco segue alto pelo `produto.md`, por ser contrato novo da API com isolamento entre usuários.
- **Como desfazer:** reverter o PR (`git revert <merge>`) remove as rotas. Não há migration nem dado a migrar. Os programas criados nesse meio-tempo ficam no banco sem rota, e nenhuma outra tabela depende deles.
- **Pré-mortem:**
  1. Dois programas ativos por corrida na ativação. Mitigação: transação com `updateMany` em todos os programas do usuário antes de ativar, e o C11.
  2. IDOR: ler, editar, apagar ou ativar o programa de outro usuário, ou apontar o dia para o treino de outro. Mitigação: filtro por `userId` em toda query e escrita, mais C6, C7, C8, C9 e C10.
  3. PATCH que deixa dias fora do ciclo novo. Mitigação: validar o estado final, coberto pelo C8.
  4. `startDate` deslocada por fuso: gravar `2026-11-02` e ler `2026-11-01`. Mitigação: só data, gravada como `@db.Date`; o C2 confere que a data volta igual.
- **Segurança** (skill `seguranca`, API):
  - **Controle de acesso:**
    - se aplica (IDOR em programa e em treino do dia);
    - verificação: C6 a C10, com dois usuários;
    - o revisor confere que toda chamada ao Prisma tem `userId`.
  - **Validação de entrada:**
    - se aplica;
    - verificação: DTO com `class-validator`, `whitelist` e `forbidNonWhitelisted`, mais C4 e C5;
    - o tamanho de `days` não tem teto de negócio, e o corpo da requisição já tem o limite padrão do Nest (100 kb).
  - **Autenticação:**
    - só usa o `AuthGuard` existente, sem tocar `src/auth/`;
    - verificação: C1.
  - **Dados pessoais:** não se aplica. Programa é estrutura de treino, não dado de saúde.
  - **Segredos:** não se aplica.
  - **Dependências:** não se aplica.
  - **Modelo de ameaças curto:**
    - **ativo:** os programas e os treinos de cada usuário;
    - **quem ataca:** outro usuário autenticado;
    - **o que pode dar errado:** ler ou alterar o programa alheio, ou descobrir ids de treino alheio por respostas diferentes;
    - **mitigação:** 404 igual para "não existe" e "não é seu" (programa), e 400 igual para treino inexistente ou alheio.
- **Dependências novas:** Nenhuma.

## Validação do humano
Com o app no ar (`docker compose up -d`, `npx prisma migrate deploy`, `npm run start:dev`) e o token de um usuário que tem dois treinos (crie com `POST /workouts`):

1. Crie um programa semanal A-B:
   - **requisição:** `POST /programs` com `{"name":"PPL","cycleType":"WEEKLY","weeks":2,"startDate":"2026-11-16","days":[{"week":1,"day":1,"workoutId":"<A>","order":1},{"week":2,"day":1,"workoutId":"<B>","order":1}]}`;
   - **esperado:** 201, `active: false`, `startDate` igual a `"2026-11-16"` e dois dias com o nome do treino.
2. Ative o programa:
   - **requisição:** `POST /programs/<id>/activate`;
   - **esperado:** 200 com `active: true`.
3. Crie um segundo programa, rotativo:
   - **requisição:** `{"name":"Rotativo","cycleType":"ROTATING","cycleDays":5,"startDate":"2026-11-16"}`;
   - depois ative-o;
   - **esperado:** `GET /programs` mostra só o segundo ativo.
4. Mande um dia fora do limite:
   - **requisição:** `PATCH /programs/<segundo>` com `{"days":[{"week":1,"day":6,"workoutId":"<A>","order":1}]}`;
   - **esperado:** 400.
5. Apague o primeiro programa:
   - **requisição:** `DELETE /programs/<primeiro>`;
   - **esperado:** 204, e `GET /workouts` ainda mostra os dois treinos.
6. Com o token de outro usuário, tente ler o segundo programa:
   - **requisição:** `GET /programs/<segundo>`;
   - **esperado:** 404.

- [ ] Rodei o comportamento e ele faz o que os critérios pedem.
