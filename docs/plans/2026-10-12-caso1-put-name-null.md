# Plano: `PUT /routine/:id` com `name: null` passa a devolver 400 (caso 1)

> O humano aprova antes de o `implementador` começar. O plano preenchido, com o "Resultado" ao concluir, é o registro da tarefa.

## Intenção
Hoje `PUT /routine/:id` com `{"name": null}` passa na validação e quebra no Prisma com 500. Passa a devolver 400 na validação, como qualquer `name` inválido. Só `name` muda: `description` e `items` mantêm o comportamento atual (caso 1 do `docs/domain.md`).

## Diagnóstico (conferido por comando nesta sessão)
- `src/routines/dto/update-routine.dto.ts:4`: `UpdateRoutineDto extends PartialType(CreateRoutineDto)`.
- `src/routines/dto/create-routine.dto.ts:14-17`: `name` tem `@IsString() @IsNotEmpty() @MaxLength(100)`. Essa é a única validação de `name`.
- `node_modules/@nestjs/mapped-types/dist/partial-type.helper.js:15-17` (v2.1.1): sem a opção `skipNullProperties: false`, o `PartialType` aplica `IsOptional()` em **todas** as propriedades herdadas.
- `node_modules/class-validator/cjs/decorator/common/IsOptional.js:20` (v0.15.1): `return object[propertyName] !== null && object[propertyName] !== undefined;`. Com `null`, a condição dá `false` e os validadores de `name` não rodam. **É por isso que o `null` passa.**
- `node_modules/class-validator/cjs/validation/ValidationExecutor.js:172-175`: as condições (`IsOptional`, `ValidateIf`) se combinam com **E**. Consequência: acrescentar um `@ValidateIf` em `name` numa subclasse de `PartialType(CreateRoutineDto)` **não resolve**, porque o `IsOptional` herdado continua pulando o `null`. Por isso o `name` precisa sair do `PartialType` (abordagem abaixo).
- O 500 nasce no Prisma Client, não no banco: `src/routines/routine.service.ts:83` (`tx.workoutRoutine.update`) lança `Argument \`name\` must not be null.` (saída do e2e `-t "caso 1"`, rodado nesta sessão). O texto do teste e do `domain.md` diz "falha no banco"; é impreciso, sem efeito no plano.
- Linha de base do e2e (`DATABASE_URL=...5433... npm run test:e2e -- routines-caracterizacao`): `Tests: 2 todo, 31 passed, 33 total`. Inclui `test/routines-caracterizacao.e2e-spec.ts:354`, que já afirma `PUT` com `name: ''` → 400. **"Valor vazio" (`''`) já está coberto e já dá 400;** a tarefa real é só o `null`.

## Abordagem
Em `update-routine.dto.ts`, tirar `name` do `PartialType` e redeclarar só ele, validando quando vier (inclusive `null`) e pulando só quando ausente:

```ts
export class UpdateRoutineDto extends PartialType(
  OmitType(CreateRoutineDto, ['name'] as const),
) {
  @ValidateIf((_, value) => value !== undefined)
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name?: string;
}
```

`OmitType` e `PartialType` vêm de `@nestjs/mapped-types` (já é dependência; `PartialType` já é importado dele). `ValidateIf((_, v) => v !== undefined)` é o mesmo critério que o próprio `mapped-types` usa com `skipNullProperties: false` (`type-helpers.utils.js:18-24`).

**Alternativa descartada (precisa do seu aval se preferir):** `PartialType(CreateRoutineDto, { skipNullProperties: false })`, uma linha. Mas vale para **todas** as propriedades: `description: null` e `items: null` também passariam a dar 400. Hoje, pela leitura do código, `description: null` grava `null` (coluna `String?`, `schema.prisma:49`) e `items: null` é ignorado (`routine.service.ts:77` e `:88`); **não verificado em execução**. Isso foge do escopo ("SOMENTE `name`"), por isso não é a recomendação. Ver pergunta 2.

**Custo da abordagem:** as regras de F2 para `name` (`IsString`, `IsNotEmpty`, `MaxLength(100)`) ficam escritas em dois DTOs. É duplicação de três decoradores, não abstração nova. Se o limite de 100 mudar, os dois arquivos mudam.

## Critérios de aceite
- [ ] `PUT /routine/:id` da própria ficha com `{"name": null}` → **400**, e o `name` da ficha continua o anterior (conferido com `GET /routine/:id`).
- [ ] `PUT /routine/:id` com `{"name": ""}` continua → 400 (já coberto em `routines-caracterizacao.e2e-spec.ts:354`).
- [ ] `PUT /routine/:id` sem `name` (ex.: só `{"description": "x"}`) continua → 200 e mantém o `name` (atualização parcial, F8).
- [ ] `PUT /routine/:id` com `{"name": "Novo"}` continua → 200 com o nome novo (coberto por `test/routines.e2e-spec.ts`, caminho feliz).
- [ ] `name` com 101 caracteres no `PUT` → 400 (o `MaxLength` redeclarado continua valendo).
- [ ] `description` e `items` sem mudança de comportamento: nenhum teste existente que os envolve muda de resultado.
- [ ] Typecheck, testes unitários, `lint:check` e e2e (`routines-caracterizacao` e `routines`) passam.

## Risco
- **Nível:** **baixo** (confirmado). Só validação de entrada de uma rota; sem schema, migration, service ou auth.
- **Toca zona de risco?** Não. (`src/routines/` e `test/` não estão na lista do `AGENTS.md`.)
- **O que pode quebrar:**
  - Cliente que hoje envia `name: null` no `PUT` recebia 500 e passa a receber 400: nenhum caso de sucesso deixa de funcionar.
  - Se o `OmitType` + redeclaração errar, `name` poderia virar obrigatório no `PUT` (quebra a atualização parcial, F8) ou deixar de ter `MaxLength`. Os critérios 3 e 5 cobrem isso.
  - `whitelist` + `forbidNonWhitelisted` (`src/main.ts:8-12`): `name` precisa continuar com decorador para não ser recusado como campo desconhecido; o critério 4 cobre.

## Tarefas (um commit cada)
1. **Teste primeiro (commit 1, `test(routines): ...`):** em `test/routines-caracterizacao.e2e-spec.ts`, o teste `caso 1` (linhas 447-458) deixa de afirmar o 500 e passa a afirmar 400 + `name` inalterado. Como não diverge mais do `domain.md`, sai de `describe('comportamento atual (diverge de domain.md)')` (linha 370) e vai para `describe('PUT /routine/:id')` (linha 270), junto do teste `400 com name vazio ou campo desconhecido` (linha 347). Acrescentar os casos dos critérios 3 e 5 (sem `name` → 200; 101 caracteres → 400). Rodar o e2e e **registrar que o caso `null` falha** (recebe 500) antes da correção. Os casos novos dos critérios 3 e 5 devem passar já aqui (caracterizam o comportamento que precisa ser preservado).
2. **Correção + docs (commit 2, `fix(routines): ...`):** alterar `src/routines/dto/update-routine.dto.ts` conforme a abordagem; atualizar `docs/domain.md` e `docs/architecture.md` (seção Documentação) **no mesmo commit**. Rodar tudo de "Como verificar"; o teste do commit 1 passa a passar.
3. **Fechamento (commit 3, `docs: ...`):** preencher "Resultado" neste plano, uma linha em `docs/RETRO.md`, atualizar `docs/STATUS.md` (tirar o caso 1 de "Divergências" e da "Fila de código").

Diff estimado de produção: ~10 linhas (um arquivo). Testes: ~30 linhas.

## Arquivos a tocar
| Arquivo | Mudança |
|---|---|
| `test/routines-caracterizacao.e2e-spec.ts` | Teste do caso 1 vira 400 e muda de `describe`; casos de preservação (sem `name`, 101 caracteres). |
| `src/routines/dto/update-routine.dto.ts` | `PartialType(OmitType(CreateRoutineDto, ['name']))` + `name` redeclarado com `ValidateIf(v !== undefined)`. |
| `docs/domain.md` | Caso 1 resolvido; linha "Caso 1" sai de "Mudanças de código decorrentes". |
| `docs/architecture.md` | Linhas 104, 119 e 141: descrição do `UpdateRoutineDto` e das divergências. |
| `docs/plans/2026-10-12-caso1-put-name-null.md` | "Resultado". |
| `docs/RETRO.md` | Uma linha. |
| `docs/STATUS.md` | Caso 1 resolvido. |

Qualquer outro arquivo no diff é suspeito (em especial `create-routine.dto.ts`, `routine.service.ts`, `routine.controller.ts`, `src/main.ts`).

## Abstrações novas
- Nenhuma.

## Dependências novas
- Nenhuma. (`OmitType` está em `@nestjs/mapped-types`, já usado em `update-routine.dto.ts:1`.)

## Como verificar
```bash
npm run typecheck
npm test
npm run lint:check
# e2e (Postgres do docker-compose, porta 5433; credenciais do docker-compose.yml, sem ler o .env)
docker compose ps   # treino_postgres "Up", 0.0.0.0:5433->5432
DATABASE_URL="postgresql://postgres:1234@localhost:5433/exactafitdb" npm run test:e2e -- routines
```
- Commit 1: o e2e deve **falhar** só no caso `null` (esperado 400, recebido 500).
- Commit 2: e2e de `routines` todo verde; contagem esperada: 31 passed + os casos novos, 2 todo.
- Opcional, e2e completo: `DATABASE_URL=... npm run test:e2e`.
- Se as migrations do banco local estiverem defasadas, `npx prisma migrate deploy` **pede confirmação** do humano antes (zona de risco); nesta sessão o e2e rodou sem isso.

## Documentação (definição de pronto)
- [x] Atualiza: `docs/domain.md` | `docs/architecture.md` (no commit 2, junto da correção)
  - `domain.md:155` (caso 1): decisão vira **Resolvido**: `null` e `''` em `name` no `PUT` dão 400.
  - `domain.md:179`: remover a linha "Caso 1" de "Mudanças de código decorrentes" (o cabeçalho diz "Nada disso está implementado"; deixá-la contradiz o código). A linha F1 (trade-off 3), logo abaixo, **fica**.
  - `domain.md` F2 (linha 102): sem mudança de texto; a regra ("nome obrigatório") passa a valer também no `PUT` quando `name` vem.
  - `architecture.md:104`: `UpdateRoutineDto` = `PartialType(OmitType(..., ['name']))` + `name` validado quando presente, inclusive `null`.
  - `architecture.md:119`: tirar "caso 1" da lista de divergências travadas por teste.
  - `architecture.md:141`: remover o item (deixa de ser verdade).
- [ ] ~~Sem impacto em doc~~

## Fora de escopo
- Filtrar por `userId` na escrita do `PUT` (F1, trade-off 3; `routine.service.ts:76-83`): tarefa separada.
- `description: null` e `items: null` no `PUT` (comportamento atual mantido; ver pergunta 2).
- `name` só com espaços (`"   "`): hoje passa no `POST` e no `PUT` (`IsNotEmpty` só recusa `''`); mudar exige decisão (pergunta 1).
- Trim de `name`, mensagens de erro customizadas, filtro global de erros do Prisma.
- `POST /routine` com `name: null`: pelo código já dá 400 (`IsString` roda, sem `IsOptional`); **não verificado em execução**, sem mudança.
- F6 (`exerciseId` inexistente → 400), F4, F11: próximos itens da fila.
- `AGENTS.md` "Dívida conhecida" ainda cita `wip/sessions` como pendente, mas o PR #18 já a mergeou (`git log`: `0b0814b Merge pull request #18 from jonatasmota404/wip/sessions`); `STATUS.md` também está defasado (cita `5722f6e`). Não corrigir aqui além do caso 1 no STATUS; registrar como pendência.

## Perguntas para o humano
1. **Só espaços conta como "vazio"?** O pedido diz "rejeitar `null` e valor vazio". `''` já dá 400. `"   "` hoje é aceito no `POST` e no `PUT`; o `domain.md` (F2, caso 1) não diz nada. Recomendo **não** mexer agora (mudaria também o `POST`, fora do caso 1) e, se quiser, abrir regra nova em F2. Confirma?
2. **Abordagem:** confirma a redeclaração só de `name` (escopo exato, três decoradores duplicados) em vez de `skipNullProperties: false` (uma linha, mas `description: null` e `items: null` também viram 400)? Ligado a isso: `description: null` no `PUT` deve continuar limpando a descrição? O `domain.md` não responde.
3. **Lugar do teste:** ok mover o teste do caso 1 de `comportamento atual (diverge de domain.md)` para `PUT /routine/:id`, já que deixa de ser divergência?

## Resultado (preencher ao concluir)
- **O que foi feito:**
- **Desvios do plano:**
- **Pendências:**
- **PR/commit:**
- **Docs atualizadas:**
