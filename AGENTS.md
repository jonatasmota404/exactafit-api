# AGENTS.md — exactafit-api

API de treino (NestJS 11 + TypeScript + Prisma 7 + PostgreSQL 16). Contexto: `docs/domain.md`, `docs/adr/`.

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
- Testes de integração: `test/*.e2e-spec.ts` (supertest, exigem Postgres); os `*-caracterizacao.e2e-spec.ts` travam o comportamento atual, inclusive divergências de `docs/domain.md`.
- Skills de Prisma já instaladas: `.claude/skills/prisma-*` são links para `.agents/skills/` (use-as; não duplique).

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
3. **Sem dependência nova** sem aprovação explícita do humano. Só peça a aprovação depois de conferir o pacote no registro oficial e preencher a tabela "Dependências novas" do plano: existe, nome exato (sem letra trocada em relação ao pacote conhecido), primeira e última publicação, mantenedor, licença, e o comando usado com a saída colada (ex.: `npm view <pacote> name time.created time.modified maintainers license`).
   Pacote que não existe, tem menos de ~30 dias ou tem nome parecido com outro muito usado: **pare e relate; nunca instale**.
4. **Diffs pequenos**: um commit por tarefa; se o diff de código de produção passar de ~300 linhas, pare e divida. Testes de caracterização e docs podem exceder, em commits coesos.
5. **Nunca declare "pronto" com typecheck, testes ou lint falhando.** Se não conseguir corrigir, diga o que falha.
6. Não invente comandos: use só os da tabela acima.
7. Na dúvida sobre regra de negócio ou faltando informação de domínio, pergunte. Não presuma (veja `docs/domain.md`).

## Regras de verificação
1. Antes de chamar um problema de "pré-existente" ou "dívida antiga", reproduza-o na `main` limpa.
2. Afirmação sobre dependências, build, ambiente ou deploy exige comando executado e saída citada. Sem execução, marque **"não verificado"**.
3. **Teste primeiro.** Tarefa que muda comportamento começa pelo teste do critério de aceite, que deve falhar pelo motivo certo antes da implementação. Nunca altere, enfraqueça, desative ou apague teste existente para fazê-lo passar; se o teste estiver errado, pare e relate. Escreva só o teste que o critério pede (nada de caso impossível ou detalhe interno). Documentação, configuração e refatoração já coberta por testes ficam de fora, e o plano declara isso.

## Fluxo de trabalho
1. O modelo da sessão é definido no início. Se a tarefa recomenda outro modelo, avise antes de começar; não siga com o errado.
2. Toda branch nasce da `main`. Se depende de outra branch, mergeie a outra primeiro (merge commit, não squash).
3. Tarefa não trivial → plano em `docs/PLAN_TEMPLATE.md`, aprovado pelo humano. O plano preenchido fica em `docs/plans/` e, com a seção "Resultado" preenchida ao concluir, é o registro da tarefa.
4. Subagente `implementador` executa o plano aprovado (um commit por tarefa).
5. Subagente `revisor` revisa o diff (somente leitura), com o checklist de `docs/REVIEW.md`.
6. Decisão estrutural → ADR em `docs/adr/` (copie `0000-template.md`).
7. Ao fechar cada tarefa, adicione uma linha em `docs/RETRO.md`.
8. **Merge e push na `main` são sempre do humano.** O agente nunca os executa, mesmo que um prompt os mencione, e avisa se a tarefa exigir isso.
9. **Definição de pronto:** tarefa que mude rota, schema, regra de negócio ou módulo atualiza `docs/domain.md` ou um ADR **no mesmo commit**, ou declara no plano `Sem impacto em doc: <motivo>`. Um hook avisa quando isso falta (aviso, não bloqueio).
10. Ao concluir, preencha o "Resultado" do plano, incluindo o bloco "Para o manual". O manual do humano é mantido pelo curador, fora do repositório; o agente de desenvolvimento **não** lê nem escreve o manual.
11. Uma branch de docs/pipeline por vez; a próxima só nasce da `main` depois do merge da anterior.

## Zonas de risco (pedem confirmação)
`prisma/migrations/`, `prisma/schema.prisma`, `src/auth/`, `.github/workflows/`, `package.json`, `.claude/`.
Comandos `prisma migrate`/`db` também pedem confirmação. Merge e push na `main` não são do agente (Fluxo de trabalho 8).

## Guardrails automáticos (`.claude/settings.json`)
- Hook `PreToolUse` bloqueia: `rm -rf`, push forçado, `git reset --hard`, `git clean -f`, `git branch -D` e `-d --force`, `prisma migrate reset`, `prisma db push` destrutivo, SQL destrutivo, `docker compose down -v`, acesso a `.env`/chaves. Testes: `node --test '.claude/hooks/*.test.mjs'`.
- **Falso positivo conhecido:** o hook casa texto e não entende shell. Ele bloqueia padrão perigoso que aparece só como texto (corpo de PR, mensagem de commit). Contorno: escreva o texto num arquivo e use `gh pr create --body-file <arq>` ou `git commit -F <arq>`. Se qualquer comando for negado (hook, permissão ou classificador), pare e relate; nunca contorne trocando de branch, diretório ou comando, e nunca atribua ao humano uma autorização que ele não deu.
- Merge e push na `main` são bloqueados pelo hook `guard-main` (independe de permissões) e pela proteção de branch no GitHub; `gh pr merge` está em deny. Quem mergeia é o humano, pelo PR.
- Hook `Stop` roda typecheck + testes unitários + `npm run lint:check` (projeto inteiro; comandos em `.claude/verify.json`); bloqueia o encerramento se falharem.
- Nunca leia nem imprima `.env` ou segredos.
- O `Stop` também chama `.claude/hooks/doc-warning.mjs`, que só **avisa** (nunca bloqueia): mudança em controller, service, dto ou schema/migrations sem doc nem "Sem impacto em doc", link relativo quebrado em `docs/` e número de ADR duplicado.
- E chama `.claude/hooks/test-warning.mjs`, que também só **avisa**: arquivo de teste apagado, teste desativado (`skip`, `todo`, `only`, `xit`) ou menos verificações do que na `main`. Alteração intencional de teste se declara com `Teste alterado: <motivo>` no commit ou no plano.

## Cuidados conhecidos
- Módulo sessions entrou na main via PR #18 sem plano nem revisão contra domain.md (S1–S9) e sem testes de caracterização; auditoria pendente antes de qualquer deploy.
