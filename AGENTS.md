# AGENTS.md — exactafit-api

API do Exacta Fit (treino, dieta e acompanhamento): NestJS 11 + TypeScript + Prisma 7 + PostgreSQL 16. Produto, fases e ordem das tarefas: `docs/produto.md`. Domínio: `docs/domain.md`. Decisões: `docs/adr/`.

## Comandos (todos verificados)
| Ação | Comando |
|---|---|
| Typecheck | `npm run typecheck` |
| Lint (só verifica) | `npm run lint:check` · `npm run lint` usa `--fix` (altera arquivos) |
| Testes unitários (`src/**/*.spec.ts`) | `npm test` |
| Testes e2e (`test/*.e2e-spec.ts`, exige Postgres) | `npm run test:e2e` |
| Build | `npm run build` |
| Prisma | `npx prisma validate` · `npx prisma generate` · `npx prisma migrate dev --name <nome>` |
| Preparar worktree | `npm ci && npx prisma generate` (depois disso `npm test` passa num worktree novo) |
| Subir o app | **não verificado**: `docker compose up -d`, `npx prisma migrate deploy` e `npm run start:dev`; no ar quando `GET http://localhost:3000/` devolve `{ "status": "ok" }`. Usuário de teste: criar por `POST /auth/register` |

**Postgres para e2e:** `docker compose up -d` → porta **5433** local (docker-compose). No CI é **5432**. Ajuste `DATABASE_URL` e `JWT_SECRET` no `.env` e rode `npx prisma migrate deploy` antes do e2e.

## Convenções
- Lógica no service; controller só recebe, valida (DTO + class-validator) e delega.
- Rotas autenticadas usam `@UseGuards(AuthGuard)`; `userId` vem do token, nunca do body.
- Toda query de recurso do usuário filtra por `userId`.
- Escrita em múltiplas tabelas → `prisma.$transaction`.
- Mudança de schema = nova migration (nunca editar migration existente).
- Testes de integração: `test/*.e2e-spec.ts` (supertest, exigem Postgres); os `*-caracterizacao.e2e-spec.ts` travam o comportamento atual, inclusive divergências de `docs/domain.md`.
- Skills de Prisma: `.claude/skills/prisma-*` são links para `.agents/skills/` (use-as; não duplique).
- Commits: Conventional Commits (`feat(escopo): ...`, `fix(...)`, `test(...)`, `chore(...)`), em PT ou EN como no histórico.

## Regras
1. **Menor mudança que resolve.** Antes de escrever: precisa mesmo? Já existe no projeto, no framework ou numa dependência instalada? Dá para configurar? Nada além do escopo pedido.
2. **Sem abstração antes do segundo uso real** (helper, base genérica, interface "para o futuro").
3. **Teste primeiro.** Cada critério de aceite vira um teste que falha pelo motivo certo antes do código, num commit só de testes. Nunca altere, enfraqueça, desative ou apague teste para fazê-lo passar; se o teste estiver errado, pare e relate. Sem comportamento novo (doc, configuração, refatoração coberta), declare `Sem teste novo: <motivo>`.
4. **Nunca declare pronto com typecheck, testes ou lint falhando.** Se não conseguir corrigir, diga o que falha.
5. **Dependência nova só com aprovação do humano**, pedida depois de conferir o pacote no registro oficial, com o comando e a saída colados: existe, nome exato (sem letra trocada), primeira e última publicação, mantenedor, licença. Pacote que não existe, tem menos de ~30 dias ou nome parecido com outro muito usado: **pare e relate; nunca instale**. Lockfile no mesmo commit do manifesto.
6. Diff de código de produção acima de ~300 linhas: pare e divida.
7. Regra de negócio que não está em `docs/domain.md`: pergunte; não presuma. Regra nova ou alterada vai para `docs/domain.md` no mesmo PR; decisão difícil de reverter, para um ADR (`docs/adr/0000-template.md`).
8. Afirmação sobre ambiente, dependência, build ou comando exige comando executado e saída; sem isso, **"não verificado"**. Antes de chamar um problema de pré-existente, reproduza-o na `main` limpa.
9. **Merge e push na `main` são só do humano.** A branch nasce da `main` atualizada; o agente abre o PR e para.
10. Comando negado (hook, permissão, classificador): pare e relate. Nunca contorne trocando de branch, diretório ou comando, e nunca atribua ao humano uma autorização que ele não deu.

## Risco: quem decide o quê
| Risco | Quando | O humano | O agente |
|---|---|---|---|
| Baixo | local, reversível, coberto por teste | lê o resumo do PR e mergeia | trabalha sozinho até o PR; sem arquivo de plano |
| Médio | regra de negócio nova ou alterada | aprova só os critérios de aceite (na conversa ou no PR), não o código | skills `planejar-tarefa` e `executar-tarefa`; critérios viram testes antes do código |
| Alto | dinheiro, dados, autenticação, migrations, contrato externo, zona de risco | aprova critérios e plano de risco; valida rodando o comportamento | como no médio, mais plano em `docs/plans/`, `revisor-de-plano` e skill `seguranca` |

Na dúvida entre dois níveis, use o maior. Bug fora de zona de risco: skill `corrigir-bug`. Todo PR passa pelo subagente `revisor`, em contexto limpo, antes de abrir; se tem tela, endpoint ou comando que alguém usa, também pelo `testador`.

## Zonas de risco (pedem confirmação)
`prisma/migrations/`, `prisma/schema.prisma`, `src/auth/`, `.github/workflows/`, `package.json`, `.claude/`. Comandos `npx prisma migrate *` e `npx prisma db *` também pedem confirmação.

## Guardrails automáticos (`.claude/settings.json`)
- `block-destructive` bloqueia `rm -rf`, push forçado, `git reset --hard`, `git clean -f`, `git branch -D` e `-d --force`, `prisma migrate reset`, `prisma db push` destrutivo, SQL destrutivo, remoção de volumes de dados e acesso a `.env` e chaves.
- `guard-main` bloqueia merge e push na `main`, `gh pr merge` e escrita pela `gh api`. Quem mergeia é o humano, pelo PR.
- `lint-on-edit` roda o `onEdit` de `.claude/verify.json` no arquivo recém-editado e devolve o erro na hora.
- `verify-on-stop` roda os `checks` de `.claude/verify.json` (typecheck, testes, lint) e bloqueia o encerramento se falharem; também chama `test-warning`, que avisa teste apagado, desativado ou com menos verificações que na `main` (alteração intencional: `Teste alterado: <motivo>` no commit).
- Falso positivo: os hooks casam texto. Padrão perigoso só em texto (mensagem de commit, corpo de PR) vai por arquivo: `git commit -F <arq>`, `gh pr create --body-file <arq>`.
- Testes dos hooks: `node --test '.claude/hooks/*.test.mjs'`. Nunca leia nem imprima `.env` ou segredos.

## Cuidados conhecidos
- Módulo sessions auditado contra S1–S9: achados A1–A10 em `docs/plans/2026-10-19-auditoria-sessions.md` e comportamento atual travado em `test/sessions-caracterizacao.e2e-spec.ts`. Tarefas 2 e 3 de `docs/produto.md` corrigiram A1–A7 e A9; pendentes: o índice que garante S3 com dois aparelhos ao mesmo tempo e a exceção do sincronismo (tarefa 17).
