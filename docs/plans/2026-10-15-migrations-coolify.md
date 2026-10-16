# Plano: como as migrations do Prisma rodam no deploy (VPS própria, Coolify, Dockerfile)

> O humano aprova antes de o `implementador` começar. O plano preenchido, com o "Resultado" ao concluir, é o registro da tarefa.

Aprovado por: humano, em 2026-10-16, ao mandar implementar este plano com a alternativa E1 e as decisões listadas no pedido.
Modelo recomendado: Sonnet 5.5 (o da sessão) — decisão de implantação e ajuste de documentos; não há código de aplicação.

## Intenção
Fechar a dúvida aberta nos planos do Dockerfile e das dependências: onde `prisma migrate deploy` roda quando a plataforma é o Coolify. A pesquisa na documentação oficial mostra que a recomendação anterior (job de pré-deploy com target `migrate`, CLI fora do runtime) **não é sustentada pelo que o Coolify documenta**. Este plano registra o que a documentação confirma e o que não confirma, recomenda a opção cujas premissas são todas documentadas e lista o que só dá para provar na VPS.

## O que a documentação do Coolify confirma e não confirma
Páginas lidas nesta sessão (WebFetch, consulta de 2026-10-15). Onde o texto veio só de resumo de busca e a página não foi lida inteira, está marcado.

| # | Tema | Confirma | **Não** confirma / ambíguo | Fonte |
|---|---|---|---|---|
| 1 | Build pack Dockerfile | **Base Directory** = contexto de build; **Dockerfile Location** = caminho relativo a ele; "build arguments"; `HEALTHCHECK` no Dockerfile; **Ports Exposes**; "o processo deve escutar em `0.0.0.0`". | **Seleção de target (`--target`/"Target Stage") não está documentada**: as três páginas do build pack dizem só que o Dockerfile dá controle sobre "build stages" e não explicam como escolher um. | [builds/packs/dockerfile](https://coolify.io/docs/builds/packs/dockerfile), [applications/builds/dockerfile](https://coolify.io/docs/applications/builds/dockerfile), [applications/build-packs/dockerfile](https://coolify.io/docs/applications/build-packs/dockerfile) |
| 2 | **Pré-deploy** | "roda **no contêiner atual da aplicação, antes da substituição**"; "pulado quando não há contêiner atual, **inclusive no primeiro deploy**"; "um pré-deploy que falha **interrompe** o deploy". | Não diz qual imagem; pelo texto é a **imagem antiga**. Não documenta timeout nem shell (resumo de busca: executado com `sh -c`). | [applications/build-packs/dockerfile](https://coolify.io/docs/applications/build-packs/dockerfile) |
| 3 | **Pós-deploy** | "roda **no contêiner recém-implantado**"; "o deploy é **marcado como concluído antes** do pós-deploy"; "falha é registrada no log mas **não altera** o status de sucesso". | **Não diz se roda antes ou depois de o tráfego trocar**; não diz o que acontece no primeiro deploy. | [applications/build-packs/dockerfile](https://coolify.io/docs/applications/build-packs/dockerfile) |
| 4 | Docker Compose como build pack | "Coolify analisa a definição e adiciona a configuração necessária"; `exclude_from_hc: true` para "um serviço que roda uma vez, **como um contêiner de migration**", para não determinar a saúde do app; modo **Raw (deploy file as-is)** exige que você forneça labels de proxy e rede; Compose Git **não usa** a página Healthcheck da aplicação. | **`depends_on`, `condition: service_completed_successfully`, `restart: "no"` e `build.target` não são mencionados.** Funcionam no Docker Compose em si, mas o Coolify reescreve o arquivo e a documentação não diz se preserva essas chaves. Busca por fontes oficiais sobre a combinação: **nada encontrado**. | [builds/packs/docker-compose](https://coolify.io/docs/builds/packs/docker-compose), [knowledge-base/docker/compose](https://coolify.io/docs/knowledge-base/docker/compose) |
| 5 | Rolling update e health check *(resumo de busca; página não lida inteira)* | Coolify sobe o contêiner novo com o atual ainda ativo, **espera o health check passar**, **mantém o atual se o novo ficar `unhealthy`** e só então remove o antigo; sem health check, "contêiner iniciado" vale como pronto; o `HEALTHCHECK` da **imagem tem precedência** sobre o configurado no painel. **Rolling update não é suportado para apps Docker Compose.** | Parâmetros de `start-period`/timeout do próprio Coolify. | [applications/deployments/rolling-updates](https://coolify.io/docs/applications/deployments/rolling-updates), [applications/configuration/health-checks](https://coolify.io/docs/applications/configuration/health-checks) |
| 6 | Vários apps, um repositório | Cada recurso aponta para o repositório com seu **Base Directory** e **Dockerfile Location**, então dá para ter `Dockerfile` e `Dockerfile.migrate` em apps distintos. | **Nenhuma página oficial trata explicitamente "N aplicações, mesmo repositório"** (inferência dos campos acima). | [applications/builds/dockerfile](https://coolify.io/docs/applications/builds/dockerfile) |
| 7 | Comando pontual | Existem **Terminal** do recurso e **Scheduled Tasks** (comando num contêiner **em execução**, cron, timeout 60–36000 s, histórico de execuções). | Não há "job que roda uma vez e termina" documentado para uma **aplicação** (o contêiner de app é de longa duração). `Scheduled tasks` roda **num contêiner que já existe**, ou seja, precisa do CLI nele. | [knowledge-base/applications](https://coolify.io/docs/knowledge-base/applications), [applications/operations/scheduled-tasks](https://coolify.io/docs/applications/operations/scheduled-tasks) *(busca)* |
| 8 | Banco | Postgres é **recurso gerenciado pelo Coolify** (contêiner + volume + health check + **backups agendados** para PostgreSQL); apps na mesma rede de destino usam a **Internal URL**; "Coolify **não publica** endpoint do banco por padrão". | Diz que migrations de **schema** "continuam sendo responsabilidade do engine/aplicação": **o Coolify não roda migration de app**. | [databases/how-databases-work](https://coolify.io/docs/databases/how-databases-work) |
| 9 | Segurança do Coolify | Há CVE de injeção por quebra de linha em pré/pós-deploy corrigida na `4.0.0-beta.471` *(resumo de busca; ver [CVE-2026-34152](https://osv.dev/vulnerability/CVE-2026-34152))*. | Versão instalada na VPS: **não verificado**. | — |

**Conclusão que a documentação sustenta, e que muda o plano:**
- O pré-deploy roda na **imagem antiga**. Ele nunca teria as migrations novas (que estão na imagem nova) e, no primeiro deploy, nem roda. **Está descartado mesmo com o CLI no runtime.** Isso corrige a dúvida do pedido: "pré-deploy dentro do contêiner da aplicação" não serve para migrations.
- Não existe, na documentação, uma forma **documentada** de rodar um passo "migrate e termina, com a imagem nova, antes de trocar o tráfego". As alternativas que o simulam dependem de comportamento **não documentado**.

## Verificação local feita nesta sessão (para a falha no meio da migration)
Imagem de protótipo com CLI (`proto-cli`, do plano do Dockerfile), Postgres 16 descartável, uma migration extra com `CREATE TABLE "meia_migration" (...); SELECT 1/0;`:

| Fato | Evidência |
|---|---|
| A migration falha com `division by zero` e `prisma migrate deploy` sai com **exit 1** | `prisma exit=1` |
| **Não é atômica**: a tabela `meia_migration` **ficou criada** e a migration ficou registrada como falha (`finished_at` nulo) | `to_regclass` → `meia_migration`; `_prisma_migrations` → `…_quebrada|f|f` |
| A execução seguinte **não reaplica**: `Error: P3009 … found failed migrations … new migrations will not be applied` | log da 2ª execução |

Consequência: uma migration que falha no meio exige **intervenção manual** (reverter à mão o que ficou e `prisma migrate resolve`), em qualquer alternativa. Por isso a restauração por backup e migrations pequenas, compatíveis com a versão anterior (expand/contract), valem mais do que a escolha de onde rodar.

## Alternativas

| | Mantém CLI fora do runtime? | Como falha; API sobe com schema desatualizado? | Reversível? | Esforço por deploy | `npm audit --omit=dev --omit=optional` | Depende de comportamento **não documentado**? |
|---|---|---|---|---|---|---|
| **A. Pré-deploy na aplicação** | Não (precisaria do CLI) | Roda na **imagem antiga**: aplica as migrations **antigas**; no 1º deploy nem roda | — | baixo | 9 (CLI presente) | não, e **mesmo assim não funciona** (item 2) |
| **B. Compose: serviço `migrate` + `depends_on: service_completed_successfully` + `build.target`** | **Sim** | Se `migrate` falhar, a API **não** inicia (se o Coolify preservar `depends_on`). | sim | baixo, depois de montado | 4 (corrigíveis) | **sim**: `depends_on`, `service_completed_successfully`, `build.target` (itens 4) |
| | | Perde **rolling update** (item 5): há janela sem resposta a cada deploy | | | | |
| **C. Segunda aplicação (`Dockerfile.migrate`)** | Sim | A migration é um **app de longa duração** que precisa ser disparado à mão ou por webhook **antes** da API; a ordem não é garantida pelo Coolify: API nova pode subir **sem** migration aplicada | sim | **alto** (dois deploys e ordem manual) | 4 | sim (contêiner que sai é tratado como falha/reinício) |
| **D. Migrations pelo CI** | Sim | Falha antes do deploy; mas o runner precisa alcançar o banco, que o Coolify **não publica** por padrão (item 8): exige porta pública do Postgres, túnel SSH ou runner na VPS | sim | médio (segredo do banco no CI, abrir porta) | 4 | não, mas **amplia a superfície do banco** |
| **E1. CLI no runtime; migrate no start do contêiner** (`prisma migrate deploy && exec node dist/main`) | **Não** | Contêiner novo roda a migration **antes** de ouvir a porta. Se falhar, ele sai com exit 1, o health check não passa e o Coolify **mantém o contêiner atual** (item 5). **Nunca há API nova servindo com schema velho.** | sim (mover o comando) | **nenhum** (automático) | **9** (cadeia do Prisma volta; ver "Efeito nos outros planos") | **não** (usa só itens 5 e 1) |
| **E2. CLI no runtime; migrate em pós-deploy** | Não | Deploy já está "concluído" (item 3): a API sobe **antes** da migration; falha de migration **não** derruba o deploy | sim | baixo | 9 | **sim** (ordem em relação ao tráfego, item 3) |

## Recomendação: **E1** (CLI no runtime, migration no start do contêiner, health check obrigatório)
Em uma frase: é a única opção em que **todo o comportamento de que ela depende está documentado** (rolling update com espera de health check e preservação do contêiner antigo; precedência do `HEALTHCHECK` da imagem), e ela dá a semântica de segurança que se queria do job de pré-deploy (migration falhou, nada novo recebe tráfego). Custo: o CLI e a cadeia vulnerável voltam à imagem (818 MB), reabrindo o PR 2 do plano das dependências.

**O que ela assume da documentação (e como confirmar na VPS):**

| Premissa | Fonte | Verificação na VPS | Estado |
|---|---|---|---|
| Contêiner novo que não fica `healthy` **não** substitui o atual | item 5 (busca) | Deploy de uma migration propositalmente quebrada num app de teste; conferir que a versão antiga continua respondendo e o deploy aparece como falho | **não verificado** |
| O `HEALTHCHECK` da imagem é o usado (e tem `--start-period` suficiente para a migration) | item 5 (busca) | `docker inspect` do contêiner na VPS: `Health.Status` e `Healthcheck` | **não verificado** |
| Variáveis de ambiente do painel entram no contêiner em runtime (`DATABASE_URL`, `JWT_SECRET`) e **não** viram argumento de build | item 1 (build args) | Marcar como "somente runtime" (se o painel tiver a opção) e conferir `docker history` da imagem sem o segredo | **não verificado** (nome exato do controle no painel não está na documentação lida) |
| Postgres no mesmo destino acessível pela **Internal URL** | item 8 | `docker exec` na app: conexão com a URL interna | **não verificado** |
| Versão do Coolify ≥ `4.0.0-beta.471` | item 9 | painel → versão | **não verificado** |

**Ponto em que a documentação é ambígua e decide entre E1 e B:** se o Coolify **preserva** `depends_on: service_completed_successfully` e `build.target` num Compose. A documentação **não diz**; só um teste na VPS responde. Se quiser a imagem **sem** o CLI, o caminho é **B**, e ele só entra com esse teste positivo (e aceitando a perda de rolling update). **Não escolhi B porque a premissa não é provável a partir da documentação.**

## Primeiro deploy e deploys seguintes
- **Primeiro deploy (banco vazio):** o pré-deploy do Coolify é pulado (item 2); E1 não depende dele. O contêiner roda `migrate deploy` e aplica as 6 migrations do zero (verificado no protótipo: `All migrations have been successfully applied.`). O Postgres precisa estar criado, deployado e acessível antes (item 8: "não inicia o contêiner até você fazer deploy"). **Bloqueio da fila 3 (U8):** o primeiro deploy **não acontece** antes de `JWT_SECRET` sem valor padrão; verificação de pré-voo no item "Critérios".
- **Deploys seguintes:** contêiner novo migra, sobe, fica `healthy`, o antigo sai. A versão **antiga continua rodando por alguns segundos contra o schema já migrado**: toda migration precisa ser **compatível com o app anterior** (adicionar antes de remover; sem renomear/dropar coluna que o app antigo usa na mesma versão). Isso vale para **todas** as alternativas e é regra nova a registrar no ADR.
- **Migration que falha no meio:** ver verificação local. Efeito sob E1: contêiner novo sai com exit 1 e **o antigo continua**; o `_prisma_migrations` fica com a migration como falha e **todo** novo deploy reprova com `P3009` até alguém resolver. Procedimento (a documentar no ADR, Terminal do Coolify no contêiner do Postgres + `prisma migrate resolve`): backup → desfazer à mão o parcial → `migrate resolve --rolled-back <nome>` → corrigir a migration → novo deploy. **Antes de qualquer deploy com migration, disparar o backup do Postgres** (backup agendado é documentado, item 8; agendamento e restauração: **não verificado**).
- **Concorrência:** VPS única, uma réplica; duas execuções simultâneas de `migrate deploy` (deploy duplo) são serializadas por lock do Prisma (comportamento da ferramenta, **não verificado nesta sessão**).
- **Postgres:** recomendo **recurso Postgres do próprio Coolify**, mesma rede, **Internal URL** em `DATABASE_URL`, sem porta publicada, com backup agendado. Alternativa: Postgres fora do Coolify (gerenciado): exige TLS e rede, e perde backups integrados. Reversível (troca de `DATABASE_URL`).

## Efeito nos outros planos

**`docs/plans/2026-10-15-dockerfile-producao.md`** (mudanças a aplicar, depois de aprovado este plano):
| Seção | Mudança |
|---|---|
| Decisão técnica | A deixa de ser "job com target `migrate`"; passa a **E1**. Tabela de alternativas substituída pela deste plano. |
| Stages / targets | Remove o target `migrate`. Dois stages: `build` e `runtime` (último). `runtime` = `npm ci --omit=dev` **com scripts** (o `@prisma/engines` baixa o schema engine), copia `node_modules/.prisma`, `dist`, `prisma/`, `prisma.config.ts`. |
| `CMD` | `["sh","-c","./node_modules/.bin/prisma migrate deploy && exec node dist/main"]` (`exec` para o Node receber `SIGTERM`; binário local em vez de `npx`). Exit ≠ 0 se a migration falhar. |
| `HEALTHCHECK` | Passa de "decisão" a **obrigatório** (sem ele o Coolify trata "iniciado" como pronto); `--start-period` folgado (ex.: 60 s, valor a definir na implementação) para não reprovar durante a migration. |
| Critérios de aceite | Troca "runtime **não contém** `prisma`" por "runtime **contém** o CLI e aplica as migrations ao subir"; acrescenta "migration quebrada → contêiner sai com exit 1 e **não** ouve a porta"; troca o audit para `npm audit --omit=dev`. |
| Variáveis de runtime | `DATABASE_URL`, `JWT_SECRET`, `PORT` (padrão 3000), `NODE_ENV=production` **somente runtime**; **Ports Exposes = 3000** no Coolify. |
| ADR 0010 | Título passa a "migrations rodam no start do contêiner, sob rolling update do Coolify". Escrito **neste** plano (tarefa 2). |
| Tamanho | Runtime ~818 MB (medido no protótipo com CLI), não 428 MB. |
| Proxy | Sem mudança: Traefik do Coolify na frente; nada lê `req.ip`; `trust proxy` continua `false` (gatilho: rate limit/log de IP). |

**`docs/plans/2026-10-15-atualizar-dependencias-vulneraveis.md`:**
- O fato "a cadeia sai do runtime" **deixa de valer**: com E1 a imagem de runtime tem o CLI. A **Parte B (PR 2) volta a ser necessária**, a menos que o humano aceite o resíduo.
- Alcançabilidade continua: `prisma`, `@prisma/config`, `deepmerge-ts`, `mysql2`, `fast-uri` rodam só no CLI, **no start do contêiner**, e `deepmerge-ts` só mescla o `prisma.config.ts` do repositório. Mas agora o CLI roda **dentro do contêiner exposto** (com a rede do Coolify e `DATABASE_URL`).
- Reabrir: `mysql2` por override (minor, sem quebra conhecida) e `deepmerge-ts` 8 em commit separado. **Nova verificação obrigatória:** `migrate deploy` dentro da imagem final (não só no host).
- Critério final de `npm audit` volta a ser `npm audit --omit=dev` (sem `--omit=optional`).

## Critérios de aceite
- [ ] `docs/adr/0010-migrations-no-start-do-conteiner.md` registra a decisão, as alternativas e as premissas **não verificadas** da tabela acima, e a regra "toda migration compatível com a versão anterior".
- [ ] Os dois planos citados têm as mudanças acima aplicadas (diff só em `docs/plans/`).
- [ ] Item de pré-voo do **primeiro deploy** registrado: `JWT_SECRET` sem padrão (fila 3) mergeado e `docker run` da imagem **sem** `JWT_SECRET` **encerra com exit ≠ 0**; enquanto não, deploy bloqueado.
- [ ] Nenhum arquivo de código, `package.json`, `prisma/` ou `.github/` alterado.

## Testes (escritos antes do código)
Sem teste novo: decisão e documentação, sem mudança de comportamento. A prova do comportamento (migration no start, falha mantém o contêiner antigo) é **teste de fumaça da imagem** (plano do Dockerfile) e **teste na VPS** (tabela de premissas), não teste automatizado do repositório.

## Risco
- **Nível:** médio.
- **Toca zona de risco?** Não nesta tarefa (só `docs/`). **Indireto:** a implementação posterior mexe em `package.json` (overrides), e o primeiro deploy depende de `src/auth/` (fila 3).
- **O que pode quebrar:** (i) premissa do rolling update não valer na versão instalada do Coolify → deploy com migration quebrada derrubaria a API; (ii) migration incompatível com a versão anterior durante a janela de rolling update; (iii) migration que falha no meio deixa o banco parcial (verificado) e bloqueia deploys por `P3009`; (iv) segredos marcados como build-time vazam em camadas da imagem.

## Menor esforço
Menor esforço: considerei pré-deploy do Coolify, Compose com serviço `migrate`, segunda aplicação, migrations pelo CI e pós-deploy; escolhi migrar no start do contêiner (E1) porque é a única alternativa cujas premissas estão **todas** documentadas, não exige orquestração nem abrir o banco, e tem a falha segura que o job de pré-deploy daria; o preço (CLI no runtime) é conhecido e mitigável pelo PR 2.

## Segurança (risco médio; segredos, banco, dependências)
- **Segredos:** `DATABASE_URL` e `JWT_SECRET` só em runtime, nunca `ARG`/`COPY`; verificar `docker history`. `JWT_SECRET` sem padrão (fila 3) **bloqueia** o primeiro deploy.
- **Banco:** Postgres sem porta publicada (padrão do Coolify, item 8); só Internal URL. A migration roda com a **mesma** credencial da aplicação (privilégio de DDL no runtime). Alternativa de menor privilégio (usuário de migration separado) **fora de escopo**; registrar no ADR como gatilho antes de ter dados reais.
- **Dependências:** nenhuma nova. A cadeia do Prisma volta ao runtime; mitigada por não alcançabilidade e pelo PR 2.
- **Plataforma:** Coolify `>= 4.0.0-beta.471` (CVE de injeção em comandos de deploy); **não** usar campos pré/pós-deploy com entrada externa (não os usamos).

## Tarefas (um commit cada, branch `docs/migrations-coolify`, nascida da `main`)
1. `docs(adr): migrations rodam no start do contêiner (Coolify)` — ADR 0010.
2. `docs(plans): alinhar plano do Dockerfile à decisão E1` — só `docs/plans/2026-10-15-dockerfile-producao.md`.
3. `docs(plans): reabrir PR 2 das dependências sob E1` — só `docs/plans/2026-10-15-atualizar-dependencias-vulneraveis.md`.
4. `docs(plans): resultado` — "Resultado" deste plano + `docs/RETRO.md`.

Estimativa de diff de produção: **0** (só documentação).

## Arquivos a tocar
| Arquivo | Mudança |
|---|---|
| `docs/adr/0010-migrations-no-start-do-conteiner.md` | novo (copiar `0000-template.md`) |
| `docs/plans/2026-10-15-dockerfile-producao.md` | alinhar à E1 (tabela acima) |
| `docs/plans/2026-10-15-atualizar-dependencias-vulneraveis.md` | reabrir PR 2 |
| `docs/plans/2026-10-15-migrations-coolify.md` | "Resultado" |
| `docs/RETRO.md` | linha da tarefa |

## Abstrações novas
- Nenhuma.

## Dependências novas
Nenhuma.

## Como verificar
```bash
git diff --stat main -- src test prisma .github package.json package-lock.json   # vazio
node --test '.claude/hooks/*.test.mjs'        # hook doc-warning: links relativos e ADR duplicado
grep -rn "0010" docs/adr | head               # número de ADR não duplicado
```
Verificação **na VPS** (executada pelo humano, resultado colado no Resultado): premissas da tabela "O que ela assume da documentação"; experimento opcional do Compose (B) em um app de teste: serviço `migrate` com `depends_on: condition: service_completed_successfully` e `build.target`, confirmando no log do Coolify que as chaves foram preservadas.

## Documentação (definição de pronto)
- [x] Atualiza: ADR `docs/adr/0010-migrations-no-start-do-conteiner.md` (no mesmo commit).
- [ ] Sem impacto em doc: <!-- não vale: há ADR -->

## Fora de escopo
- Escrever o `Dockerfile` e o `.dockerignore` (plano do Dockerfile, depois de aprovado).
- Usuário de banco separado para migration; rollback automático de migration; promover o experimento B sem teste na VPS.
- Configurar a VPS, o Coolify, Traefik, domínio, backup agendado e restauração (ação do humano).
- Remover o valor padrão do `JWT_SECRET` (`src/auth/`, fila 3), `trust proxy` e as atualizações de dependências (outros planos).

## Perguntas para o humano
1. **Aceita voltar o CLI do Prisma ao runtime (E1, 818 MB)** em troca de migration automática, falha segura e zero orquestração? Alternativa: B (imagem limpa de 428 MB), que depende de comportamento do Coolify que **a documentação não confirma** e que **perde rolling update**. Recomendo E1 agora e experimento de B depois, se o tamanho/superfície incomodar.
2. **PR 2 das dependências:** aplicar `override` de `mysql2` (e `deepmerge-ts` 8 se o CLI passar) ou **aceitar o resíduo** documentado? Recomendo o override de `mysql2` e deixar `deepmerge-ts` como resíduo aceito com gatilho (novo `prisma` 7.x).
3. **Janela com versão antiga no schema novo:** aceita a regra "toda migration compatível com a versão anterior" como política (vai para o ADR)?
4. **Postgres:** recurso do Coolify na mesma rede (recomendado) ou externo?
5. **Versão do Coolify na VPS** e se há backup agendado do Postgres antes do primeiro deploy (preciso do número da versão para fechar o item 9).
6. **Primeiro deploy bloqueado pela fila 3:** confirma que o item de pré-voo (`docker run` sem `JWT_SECRET` deve falhar) é a condição para liberar, e que a fila 3 entra **antes** do deploy?

## Resultado
- **O que foi feito:** E1 aprovada e aplicada: ADR 0010; plano do Dockerfile alinhado (stages, `CMD`, `HEALTHCHECK` obrigatório, critérios, audit, tamanho); plano das dependências com o PR 2 reaberto (só o plano). `Dockerfile` e `.dockerignore` implementados e verificados (resultado completo em `2026-10-15-dockerfile-producao.md`).
- **Respostas às perguntas (decisões do humano, 2026-10-16):** 1 sim, E1; 2 PR 2 reaberto, override de `mysql2` na mesma major e resíduo aceito de `deepmerge-ts` se a 8 quebrar o CLI; 3 sim, regra expand/contract no ADR; 4 Postgres como recurso do Coolify na mesma rede; 5 versão do Coolify e backup agendado seguem **não verificados** (a conferir na VPS); 6 sim, pré-voo é a condição e a fila 3 entra antes do deploy.
- **Confirmado por execução nesta tarefa:** migration quebrada → exit 1, nada sobe, tabela parcial permanece e a migration fica como falha (o `P3009` na execução seguinte é o comportamento já verificado no plano; nesta tarefa não reexecutei). `Healthcheck` da imagem presente com `StartPeriod 60s`.
- **Desvios do plano:** as tarefas 1–4 viraram uma branch só (`chore/dockerfile-coolify`), junto com a implementação do Dockerfile. Dois itens novos no ADR que o plano não previa: pré-voo do `JWT_SECRET` **falha hoje** e o achado do `SIGTERM` (exit 137 sem init).
- **Não verificado (continua marcado; verificação na VPS, executada pelo humano, resultado colado aqui):**

| Premissa | Verificação na VPS | Estado |
|---|---|---|
| Contêiner novo que não fica `healthy` não substitui o atual | Deploy de migration propositalmente quebrada num app de teste; a versão antiga continua respondendo e o deploy aparece como falho | **não verificado** |
| `HEALTHCHECK` da imagem é o usado, com `--start-period` suficiente | `docker inspect` do contêiner: `Health.Status` e `Healthcheck` | **não verificado** |
| Variáveis do painel só em runtime (`DATABASE_URL`, `JWT_SECRET`) | Marcar como runtime e conferir `docker history` sem o segredo | **não verificado** |
| Postgres acessível pela Internal URL | `docker exec` na app: conexão com a URL interna | **não verificado** |
| Coolify ≥ `4.0.0-beta.471` | painel → versão | **não verificado** |
| Lock do Prisma serializa dois `migrate deploy` | dois deploys seguidos / dois contêineres | **não verificado** |
| Backup agendado e restauração do Postgres | disparar backup e restaurar em banco de teste | **não verificado** |
| (opcional, alternativa B) Coolify preserva `depends_on: service_completed_successfully` e `build.target` | Compose em app de teste | **não verificado** |

- **Pendências:** fila 3 (U8) antes do primeiro deploy; decisão do `SIGTERM`; PR 2 das dependências; verificação na VPS.
- **PR/commit:** branch `chore/dockerfile-coolify`, com push; PR não aberto.
- **Docs atualizadas:** ADR 0010; planos do Dockerfile e das dependências; `docs/RETRO.md`.

### Para o manual
- **O que mudou no comportamento:** nenhum no app; muda a forma de implantar (migration no start do contêiner).
- **Decisões novas em domain/ADR:** ADR 0010.
- **O que o humano precisa entender:** o pré-deploy do Coolify **não serve** para migration (roda na imagem antiga); migration que falha no meio exige intervenção manual; backup antes de cada deploy com migration; as premissas do Coolify ainda precisam do teste na VPS.
