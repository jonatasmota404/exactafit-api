# Plano: `GET /` vira health check com resposta mínima

> O humano aprova antes de o `implementador` começar. O plano preenchido, com o "Resultado" ao concluir, é o registro da tarefa.

Aprovado por: humano em 2026-10-15 (liveness, `{ "status": "ok" }`, commit único)
Modelo recomendado: Sonnet 5.5 (o da sessão) — mudança pequena, fora de zona de risco; não pede troca de modelo.

## Intenção
`GET /` deixa de devolver a string do boilerplate (`Hello World!`) e passa a devolver `{ "status": "ok" }`, para que o deploy e o monitoramento tenham uma sonda simples. Sem versão, ambiente nem dado interno.

## Diagnóstico (conferido por comando nesta sessão, na `main` limpa `bb72dbb`)
- `src/app.controller.ts:8-11`: `@Get()` → `getHello()` → `AppService.getHello()` (`src/app.service.ts:5-7`, retorna `'Hello World!'`).
- Quem depende da string atual (`grep -rn "Hello World\|getHello\|AppController\|AppService" src test`):
  - `src/app.controller.spec.ts:18-19` (unitário): `expect(appController.getHello()).toBe('Hello World!')`.
  - `test/app.e2e-spec.ts:20-23` (e2e): `.get('/').expect(200).expect('Hello World!')`.
  - Nenhum outro teste, doc do repositório ou workflow usa `GET /` (`git grep -i "hello\|health"` fora de `src`/`test` só acha texto de skills do Prisma). `AppModule` (`src/app.module.ts:18-19`) só registra controller e service.
- O e2e sobe `AppModule` inteiro e `PrismaService.onModuleInit` faz `$connect()`: **exige Postgres** (como os demais e2e).
- Linha de base: `npm test --silent` → `Test Suites: 3 passed, 3 total`.
- Manual (`/home/jonatas/manuais/exactafit-api`, só leitura nesta etapa): `STATUS.md:69,89` ("Também antes do deploy") e `referencia.md:11` descrevem o `GET /` atual.

## Decisões (padrão; baratas de reverter)
- **Formato:** `{ "status": "ok" }`, status HTTP 200. Sem outros campos. SUGESTÃO(IA, não confirmada).
- **Liveness apenas:** não consulta o banco. Se o Postgres cair, `GET /` continua 200 (a API está viva, mas pode estar inútil). Readiness com banco fica fora de escopo (Pergunta 1).
- **Sem autenticação:** rota pública, como hoje (`referencia.md:11`: "auth: não"). Sem `@UseGuards`.
- **Sem rota nova** (`/health`): o pedido é transformar `GET /`.
- **Onde fica:** `AppService.getHello()` vira `AppService.getHealth()` e o controller só delega (convenção: lógica no service). Sem apagar `AppService`.

## Critérios de aceite
- [ ] `GET /` responde 200 com corpo JSON exatamente `{ "status": "ok" }`.
- [ ] `GET /` não devolve `Hello World!` nem campo além de `status`.
- [ ] `GET /` continua público (sem token → 200).
- [ ] Typecheck, testes unitários e lint passam.

## Testes (escritos antes do código)
| Critério | Caso (entrada → esperado) | Arquivo de teste |
|---|---|---|
| Corpo e status | `GET /` sem token → 200 e `res.body` igual a `{ status: 'ok' }` (`toEqual`, garante que não há campo extra) | `test/app.e2e-spec.ts` |
| Rota pública | o mesmo caso, sem header `Authorization` | `test/app.e2e-spec.ts` |
| Contrato do service | `appController.getHealth()` → `{ status: 'ok' }` | `src/app.controller.spec.ts` |

Teste alterado: os dois testes existentes que afirmam `Hello World!` (`test/app.e2e-spec.ts:20-23`, `src/app.controller.spec.ts:18-19`) mudam de propósito: a string do boilerplate é o comportamento que esta tarefa remove. Não é enfraquecimento: o critério novo é mais estrito (corpo exato). O e2e deve **falhar pelo motivo certo** antes da implementação (recebe `Hello World!` em vez de `{status:'ok'}`). Caminho de erro: não se aplica, a rota não recebe entrada nem tem falha própria.

## Risco
- **Nível:** baixo.
- **Toca zona de risco?** não. Conferido contra a lista do `AGENTS.md`: nada em `prisma/migrations/`, `prisma/schema.prisma`, `src/auth/`, `.github/workflows/`, `package.json` nem `.claude/`. Arquivos tocados: `src/app.controller.ts`, `src/app.service.ts`, os dois specs e `docs/RETRO.md`.
- **O que pode quebrar:** quem hoje espera a string `Hello World!` (nenhum consumidor conhecido: API fora de produção, `STATUS.md`). Sonda de deploy que compare texto precisará do novo corpo.

## Menor esforço
Menor esforço: considerei `@nestjs/terminus` (dependência nova), rota `/health` separada e health check com ping no banco; escolhi trocar o retorno do método existente porque cobre o pedido (sonda de liveness) sem dependência, sem módulo e sem arquivo novo.

## Segurança
Não se aplica: risco baixo, sem autenticação, dado pessoal, segredo ou dependência. Resposta fixa, sem versão, ambiente nem dado interno (evita fingerprinting).

## Tarefas (um commit cada)
Branch: `feat/health-check`, nascida da `main`.

1. `feat(health): GET / devolve { status: "ok" }` — specs primeiro (devem falhar pelo motivo certo; saída colada no Resultado), depois `AppService.getHealth()` e `AppController.getHealth()`, removendo `getHello`. Um commit só: o hook `Stop` bloqueia com teste falhando (Pergunta 2).

## Arquivos a tocar
| Arquivo | Mudança |
|---|---|
| `src/app.service.ts` | `getHello()` → `getHealth()` retornando `{ status: 'ok' }` |
| `src/app.controller.ts` | `getHello()` → `getHealth()`, delega ao service |
| `src/app.controller.spec.ts` | espera `{ status: 'ok' }` |
| `test/app.e2e-spec.ts` | espera 200 e corpo `{ status: 'ok' }` |
| `docs/RETRO.md` | linha da tarefa (Fluxo 7) |

## Abstrações novas
- Nenhuma.

## Dependências novas
Nenhuma.

## Como verificar
```bash
npm run typecheck
npm test
npm run lint:check
docker compose up -d && npx prisma migrate deploy && npm run test:e2e
# manual (porta 3000, `npm run build` + start):
curl -i localhost:3000/   # 200, {"status":"ok"}
```
Estimativa de diff de produção: ~6 linhas.

## Documentação (definição de pronto)
- [ ] Atualiza: `docs/domain.md` | ADR
- [x] Sem impacto em doc: `docs/domain.md` não descreve `GET /` nem health check; a rota é infraestrutura, não regra de negócio. `referencia.md:11` e `STATUS.md:69,89` ficam com o curador, via "Para o manual".

## Fora de escopo
- Health check com banco (readiness), `/health`, `@nestjs/terminus`.
- Versão, uptime, ambiente ou commit na resposta.
- Alterar `STATUS.md` ou `referencia.md` (manual é do curador).
- Qualquer mudança em `src/auth/` ou outras zonas de risco.

## Perguntas para o humano
1. **Liveness ou readiness?** Recomendo **liveness** (sem banco): é o menor, não derruba o deploy por oscilação do Postgres e cobre o pedido. Alternativa: ping no banco (`SELECT 1`) — sinal mais real, mas acopla a sonda ao banco e pede teste de falha. Reversível por nova tarefa.
2. **Commits:** 1 commit (teste + código) ou 2 (teste vermelho, depois código)? Recomendo 1, com a saída do vermelho colada no Resultado.
3. **Formato** `{ "status": "ok" }` está bom, ou prefere outro (ex.: `{ "status": "up" }`)?

## Resultado (preencher ao concluir)
- **O que foi feito:** `AppService.getHealth()` retorna `{ status: 'ok' }`; `AppController.getHealth()` só delega. Specs alterados primeiro: unitário falhou (`getHealth` inexistente) e e2e falhou (recebeu `Hello World!` em vez de `{ status: 'ok' }`); depois do código, passam. Verificação: `npm run typecheck` ok; `npm test` → 3 suítes, 3 testes passam; `npm run test:e2e` (Postgres 5433) → 6 suítes, 74 passam, 3 todo; `npm run lint:check` e `npm run build` ok.
- **Desvios do plano:** nenhum. Teste alterado: `src/app.controller.spec.ts` e `test/app.e2e-spec.ts` esperavam `Hello World!`, comportamento removido por esta tarefa.
- **Pendências:** nenhuma no código; manual abaixo.
- **PR/commit:** branch `feat/health-check` (PR a abrir pelo humano).
- **Docs atualizadas:** Sem impacto em doc: `domain.md` não descreve `GET /`; infraestrutura, não regra de negócio.

### Para o manual
- **O que mudou no comportamento:** `GET /` passou de `Hello World!` (texto) para `200 {"status":"ok"}` (JSON), público, sem consultar o banco.
- **Decisões novas em domain/ADR:** nenhuma.
- **O que o humano precisa entender:** é liveness: continua 200 com o Postgres fora. Atualizar `referencia.md:11` (linha de `GET /`: `AppController.getHealth` → `AppService.getHealth`, retorna `{status:"ok"}`) e `STATUS.md:69,89` (health check feito; falta só o deploy).
