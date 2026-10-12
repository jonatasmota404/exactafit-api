# Arquitetura — exactafit-api

> Preenchido a partir do código em 2026-10-12 (commit `d6dd8c2`). O que não está claro no código está marcado `TODO(humano)`.

## Visão geral
API REST monolítica em NestJS 11. Cada domínio é um módulo Nest (controller → service → Prisma). Persistência em PostgreSQL 16 via Prisma 7 com `@prisma/adapter-pg`. Autenticação por JWT Bearer (7 dias). `ValidationPipe` global com `whitelist`, `forbidNonWhitelisted` e `transform` (`src/main.ts`).

Fluxo: `HTTP → AuthGuard (se protegido) → Controller → DTO/ValidationPipe → Service → PrismaService → Postgres`.

## Módulos

### `prisma` (`src/prisma/`)
- **Faz:** expõe `PrismaService` (um `PrismaClient` com adapter pg, lendo `DATABASE_URL`) como módulo `@Global`.
- **Não faz:** não contém regra de negócio nem repositórios.
- **Depende de:** `@prisma/client`, `@prisma/adapter-pg`, `DATABASE_URL`.

### `auth` (`src/auth/`)
- **Faz:** `POST /auth/register` (bcrypt, salt 10, e-mail único) e `POST /auth/login` (retorna `accessToken` JWT com `sub`=userId e `email`). Exporta `AuthGuard`, que valida o Bearer e popula `request.user`.
- **Não faz:** refresh token, logout, troca/recuperação de senha, papéis/permissões.
- **Depende de:** `prisma`, `@nestjs/jwt`, `bcrypt`, `JWT_SECRET`.

### `exercises` (`src/exercises/`)
- **Faz:** `POST /exercises` e `GET /exercises`: catálogo de exercícios (nome, grupo muscular, tipo; padrão `strength`). Rotas protegidas por `AuthGuard`.
- **Não faz:** edição, remoção, filtro ou paginação. O catálogo é **global**: não pertence a um usuário.
- **Depende de:** `prisma`, `auth` (guard).
- `TODO(humano)`: qualquer usuário autenticado pode criar exercício no catálogo global. Isso é intencional?

### `routines` (`src/routines/`)
- **Faz:** CRUD parcial de fichas de treino do usuário logado: `POST /routine`, `GET /routine`, `GET /routine/:id`, `PUT /routine/:id`. Itens ordenados por `order`. O `PUT` com `items` substitui todos os itens dentro de `$transaction`. Todas as queries filtram por `userId` do token.
- **Não faz:** `DELETE` de ficha; validação de que `exerciseId` existe antes de inserir (fica para a FK).
- **Depende de:** `prisma`, `auth` (guard).

### `sessions`: em desenvolvimento (branch `wip/sessions`)
- Schema já existe na `main` (`WorkoutSession`, `SetLog`, migration `20260822181835`). O módulo ainda não está mergeado.
- `TODO(humano)`: descrever o que faz, o que não faz e as dependências quando o módulo for integrado.

### `app` (`src/app.*`)
- Controller/service do boilerplate Nest (`GET /` → "Hello World!").
- `TODO(humano)`: manter como health check ou remover?

## Modelo de dados (resumo de `prisma/schema.prisma`)
`User 1─N WorkoutRoutine 1─N RoutineItem N─1 Exercise` · `User 1─N WorkoutSession N─1 WorkoutRoutine` · `WorkoutSession 1─N SetLog N─1 Exercise`. Todas as FKs usam `onDelete: Cascade`.
- `TODO(humano)`: o cascade de `Exercise` apaga itens de ficha e históricos de séries (`SetLog`) de todos os usuários. Isso é desejado?

## Zonas de risco
| Caminho | Por quê |
|---|---|
| `prisma/migrations/` | Histórico aplicado em produção/CI; nunca editar migration existente. |
| `prisma/schema.prisma` | Mudança exige migration e afeta todos os módulos. |
| `src/auth/` | Autenticação e segredo JWT. |
| `.github/workflows/` | Pipeline de CI. |

## Dívidas e pontos de atenção (não corrigidos)
- **Lint:** o hook de encerramento só faz lint nos arquivos alterados. Na base `d6dd8c2`, `npm run lint:check` passa limpo. Os 42 erros encontrados na leitura inicial estão no WIP da branch `wip/sessions` (`test/session.e2e-spec.ts` e specs de `sessions`). Corrigir ao integrar essa branch.
- **Testes unitários de `sessions`** (na `wip/sessions`): 2 suítes falham por injeção de dependência (`PrismaService` não provido no `TestingModule`).
- **CI** usa `npx tsc --noEmit` em vez de `npm run typecheck`. Ver TODO abaixo.
- **Segredo JWT com fallback hardcoded** em `src/auth/auth.module.ts`. Se `JWT_SECRET` faltar no ambiente, tokens são assinados e aceitos com um segredo que está público no repositório (o `@nestjs/jwt` cai no secret do módulo quando o guard passa `undefined`). Avaliar falhar no boot sem a env.
- **Segredos do CI** (`JWT_SECRET` e senha do Postgres de teste) estão em texto no `ci.yml`.
- Relação nomeada `exercices` (grafia) em `RoutineItem`. Renomear exige cuidado com o client gerado.
- `Exercise` não tem limites `VarChar` no banco (o DTO limita a 100).
- `README.md` é o boilerplate do Nest.

## TODO(humano)
- [ ] Trocar no CI `npx tsc --noEmit` por `npm run typecheck` (pasta de risco, não alterada).
- [ ] Rodar `npm run test:e2e` com Postgres local e confirmar que passa (não verificado na baseline).
- [ ] Responder as perguntas marcadas acima (catálogo global, cascade de `Exercise`, `app` controller).
