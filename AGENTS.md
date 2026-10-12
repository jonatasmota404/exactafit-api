# AGENTS.md — exactafit-api

API de treino (NestJS 11 + TypeScript + Prisma 7 + PostgreSQL 16). Contexto: `docs/architecture.md`, `docs/domain.md`, `docs/adr/`.

## Comandos (todos verificados)
| Ação | Comando |
|---|---|
| Typecheck | `npm run typecheck` |
| Lint (só verifica) | `npm run lint:check` · `npm run lint` usa `--fix` (altera arquivos) |
| Testes unitários (`src/**/*.spec.ts`) | `npm test` |
| Testes e2e (`test/*.e2e-spec.ts`, exige Postgres) | `npm run test:e2e` |
| Build | `npm run build` |
| Prisma | `npx prisma validate` · `npx prisma generate` · `npx prisma migrate dev --name <nome>` |

**Postgres para e2e:** `docker compose up -d` → porta **5433** local (docker-compose). No CI é **5432**. Ajuste `DATABASE_URL` e `JWT_SECRET` no `.env` e rode `npx prisma migrate deploy` antes do e2e.

## Estrutura
- `src/<modulo>/` → `*.module.ts`, `*.controller.ts`, `*.service.ts`, `dto/`. Módulos: `auth`, `exercises`, `routines`, `prisma`.
- `test/` → e2e com supertest. `prisma/` → `schema.prisma` + `migrations/`.
- Skills de Prisma já instaladas: `.claude/skills/` e `.agents/skills/` (use-as; não duplique).

## Convenções
- Lógica no service; controller só recebe, valida (DTO + class-validator) e delega.
- Rotas autenticadas usam `@UseGuards(AuthGuard)`; `userId` vem do token, nunca do body.
- Toda query de recurso do usuário filtra por `userId`.
- Escrita em múltiplas tabelas → `prisma.$transaction`.
- Mudança de schema = nova migration (nunca editar migration existente).
- Commits: Conventional Commits (`feat(escopo): ...`, `fix(...)`, `chore(...)`), em PT ou EN como no histórico.

## Regras anti-overengineering
1. Faça a **menor mudança que resolve** o problema pedido. Nada além do escopo.
2. **Sem abstração antes do segundo uso real** (nada de helpers, bases genéricas ou interfaces "para o futuro").
3. **Sem dependência nova** sem aprovação explícita do humano.
4. **Diffs pequenos**: um commit por tarefa; se o diff passar de ~300 linhas, pare e divida.
5. **Nunca declare "pronto" com typecheck, testes ou lint falhando.** Se não conseguir corrigir, diga o que falha.
6. Não invente comandos: use só os da tabela acima.
7. Na dúvida sobre regra de negócio, pergunte. Não presuma (veja `docs/domain.md`).

## Fluxo de trabalho
1. Tarefa não trivial → plano em `docs/PLAN_TEMPLATE.md`, aprovado pelo humano.
2. Subagente `implementador` executa o plano aprovado (um commit por tarefa).
3. Subagente `revisor` revisa o diff (somente leitura).
4. Decisão estrutural → ADR em `docs/adr/` (copie `0000-template.md`).

## Zonas de risco (pedem confirmação)
`prisma/migrations/`, `prisma/schema.prisma`, `src/auth/`, `.github/workflows/`, `package.json`, `.claude/`.
Push na `main`, merge e comandos `prisma migrate`/`db` também pedem confirmação.

## Guardrails automáticos (`.claude/settings.json`)
- Hook `PreToolUse` bloqueia: `rm -rf`, push forçado, `git reset --hard`, `git clean -f`, `prisma migrate reset`, SQL destrutivo, `docker compose down -v`, acesso a `.env`/chaves. Testes: `node --test '.claude/hooks/*.test.mjs'`.
- **Falso positivo conhecido:** o hook casa texto e não entende shell. Ele bloqueia padrão perigoso que aparece só como texto (corpo de PR, mensagem de commit). Contorno: escreva o texto num arquivo e use `gh pr create --body-file <arq>` ou `git commit -F <arq>`. Não tente burlar o hook.
- Hook `Stop` roda typecheck + testes unitários + `npm run lint:check` (projeto inteiro); bloqueia o encerramento se falharem.
- Nunca leia nem imprima `.env` ou segredos.

## Dívida conhecida
- Branch `wip/sessions`: 42 erros de lint e 2 suítes unitárias falhando. **Precisam estar resolvidos antes de ela voltar para a `main`.** A `main` está limpa e o hook `Stop` passa a bloquear.
