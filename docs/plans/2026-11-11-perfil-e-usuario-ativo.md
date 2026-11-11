# Plano de risco: perfil do usuário e usuário ativo no guard (tarefa 9)

> Só risco alto. Descartável: o essencial vai para a descrição do PR e este arquivo é removido (`git rm`) no mesmo PR.

Aprovado por: humano em 2026-11-11 (pontos 1–3 confirmados)
Revisão do plano: APROVADO em 2026-11-11 (revisor-de-plano, 2ª rodada)

Tarefa 9 de `docs/produto.md` (seção 9). Regras: C1 e decisões (e) e (f) de `docs/domain.md`.

## Decisões do humano (2026-11-11)
- **Sexo:** `F` ou `M`.
- **Altura:** inteiro em cm, de 100 a 250.
- **Nascimento:** data `AAAA-MM-DD`, de 1900-01-01 até hoje.
- **Opcionais:** todos os campos do perfil são opcionais. O fuso tem padrão `America/Sao_Paulo`.
- **Desativação:** só o campo `deactivatedAt` e a checagem no guard. Não há rota de desativar; desativar é pelo banco.

## Regras propostas (entram em `docs/domain.md` como U9–U11 no mesmo PR)
- **U9, perfil:** `User` ganha `sex` (enum Postgres `"Sex"` com `F`/`M`, nulo), `birthDate` (data, nula), `heightCm` (inteiro, nulo) e `timezone` (texto, obrigatório, padrão `America/Sao_Paulo`). Usuários que já existem ficam com os três primeiros nulos e o fuso padrão.
- **U10, rotas:** `GET /me/profile` e `PATCH /me/profile`, autenticadas; o usuário vem do token, não há id na rota.
  - Resposta das duas: `{ sex, birthDate, heightCm, timezone }`, com `birthDate` como `"AAAA-MM-DD"` ou `null`. Nada além desses 4 campos (nem senha, nem e-mail, nem `deactivatedAt`).
  - `PATCH` é parcial: campo omitido não muda; `null` limpa `sex`, `birthDate` e `heightCm`; `timezone: null` dá 400; corpo vazio `{}` dá 200 sem mudar nada; campo desconhecido (inclusive `deactivatedAt`) dá 400.
  - **Fuso:** nome IANA. Aceito se começa por letra, tem só letras, dígitos, `_`, `+`, `-` e `/`, até 64 caracteres, **e** o `Intl` do Node o reconhece. Deslocamento fixo (`"+03:00"`, `"-0300"`) dá 400, embora o `Intl` aceite. Grava-se o texto como veio, sem normalizar o nome (o nome canônico muda com a versão do ICU).
  - **"Hoje" do nascimento:** a data do calendário mais adiantado do mundo (UTC+14), para não recusar quem já fez aniversário no seu fuso. Data impossível (`2001-02-30`) ou fora do formato dá 400.
- **U11, guard:** depois de verificar a assinatura, o `AuthGuard` busca o usuário pelo `sub` (uma consulta pela chave primária). Usuário inexistente, desativado (`deactivatedAt` preenchido) ou token sem `sub` texto: 401 `"Token inválido"`, a mesma mensagem dos outros casos (não revela se a conta existe ou foi desativada).
  - **Erro do banco não vira 401:** só a verificação da assinatura fica no `try` que devolve 401. Se a consulta do usuário falhar (banco fora do ar), o erro sobe como 500, para o front não tratar uma queda como sessão inválida.
  - O login de um usuário desativado continua emitindo token (não muda `auth.service.ts`); o token dá 401 em toda rota protegida. Ver "Pontos para confirmar".

## Critérios de aceite
- [ ] C1: `GET /me/profile` de usuário recém-cadastrado → 200 `{ sex: null, birthDate: null, heightCm: null, timezone: "America/Sao_Paulo" }`, sem nenhum outro campo — teste: "perfil padrão" em `test/profile.e2e-spec.ts`
- [ ] C2: `PATCH /me/profile` com os 4 campos válidos → 200 com os valores gravados (`birthDate` volta `"AAAA-MM-DD"`); um `GET` seguinte devolve o mesmo — teste: "grava e devolve" em `test/profile.e2e-spec.ts`
- [ ] C3: `PATCH` parcial: só `heightCm` muda só a altura; `{ sex: null, birthDate: null, heightCm: null }` limpa os três; `{}` → 200 sem mudança — teste: "parcial e null" em `test/profile.e2e-spec.ts`
- [ ] C4: validação → 400 e nada gravado, para cada caso: `sex` `"X"` ou `"f"`; `heightCm` 99, 251, 170.5 ou `"170"`; `birthDate` `"1899-12-31"`, o dia seguinte à data atual em UTC+14, `"2001-02-30"`, `"01/02/2001"` ou `"2001-02-01T00:00:00Z"`; `timezone` `"Marte/Olympus"`, `"+03:00"`, `"-0300"`, `""`, `null` ou com 65 caracteres; campo desconhecido `deactivatedAt` ou `email`. Bordas aceitas (200): `heightCm` 100 e 250; `birthDate` `"1900-01-01"` e a data de hoje em UTC; `timezone` `"UTC"` e `"Europe/Lisbon"`, devolvidos exatamente como enviados — teste: tabela "validação" em `test/profile.e2e-spec.ts`
- [ ] C5: isolamento: o `PATCH` de A não muda o perfil de B, e o `GET` de B devolve só o de B — teste: "isolamento" em `test/profile.e2e-spec.ts`
- [ ] C6: sem token ou com token inválido, `GET` e `PATCH /me/profile` → 401 — teste: "sem token" em `test/profile.e2e-spec.ts`
- [ ] C7: token válido de usuário desativado (`deactivatedAt` preenchido pelo banco) → 401 `"Token inválido"` em `GET /exercises` e em `GET /me/profile`; o mesmo token volta a dar 200 se `deactivatedAt` voltar a nulo (a checagem é a cada pedido) — teste: "C1: usuário desativado" em `test/authguard-caracterizacao.e2e-spec.ts`
- [ ] C8: token assinado com `sub` de usuário inexistente → 401 `"Token inválido"`; token do login depois de o usuário ser removido do banco → 401; token assinado sem `sub` ou com `sub` numérico → 401 (não 500) — teste: "C1: usuário inexistente" em `test/authguard-caracterizacao.e2e-spec.ts`
- [ ] C9: se a consulta do usuário no guard falha (mock do Prisma rejeita), o guard propaga o erro e **não** lança `UnauthorizedException`; com o mock devolvendo `null` ou `deactivatedAt` preenchido, lança `UnauthorizedException('Token inválido')` — teste: unitário em `src/auth/auth.guard.spec.ts`
- [ ] C10: a migration só acrescenta colunas e preserva os usuários — prova por comando no Postgres local, colada no PR:
  1. antes do `migrate deploy`: `docker exec treino_postgres psql -U postgres -d exactafitdb -Atc "SELECT count(*) FROM users"` → N;
  2. `npx prisma migrate deploy`;
  3. `docker exec treino_postgres psql -U postgres -d exactafitdb -Atc "SELECT count(*), count(*) FILTER (WHERE sex IS NULL AND birth_date IS NULL AND height_cm IS NULL AND timezone = 'America/Sao_Paulo' AND deactivated_at IS NULL) FROM users"` → `N|N`;
  4. `npx prisma migrate diff --from-config-datasource --to-schema prisma/schema.prisma --exit-code` → "No difference detected.", exit 0.

**Teste alterado (de propósito):** em `test/authguard-caracterizacao.e2e-spec.ts`, três testes travavam o comportamento que o C1 manda mudar e passam a afirmar 401:
- "C1: aceita token assinado cujo usuário não existe no banco (200)";
- "C1: continua aceitando o token depois de o usuário ser removido do banco";
- "um token com sub aplica-se como userId nas rotas (sub aleatório lista 0 fichas)" (o `sub` aleatório não existe no banco).

O bloco "comportamento atual (diverge de domain.md)" deixa de existir; os casos vão para os blocos "recusa" e "aceita". A declaração vai na mensagem do commit de testes.

**Documentação no mesmo PR:**
- `docs/domain.md`: U9–U11 novas; linha C1 das regras de exclusão (tira "Hoje o guard só verifica a assinatura…" e registra "Implementado em 2026-11-11 (tarefa 9)" para o campo e o guard, sem a rota de desativar); as duas linhas de "Mudanças de código decorrentes" (campo de desativação e "C1 (AuthGuard) … não implementado") marcadas como implementadas.
- `docs/produto.md`: linha da tarefa 9 com o plano e "**Feito em 2026-11-11**", como nas tarefas 7a, 7b e 8.

Fora de escopo: rota de desativar ou reativar conta; exclusão de conta; recusar o login do desativado; idade mínima (a recusa de menores é do assistente, Fase 2); `name` e `email` no perfil; trocar senha; usar o fuso em `GET /today` (tarefa 15); cache da consulta do guard.

## Risco
- **Zona tocada:** `prisma/schema.prisma`, `prisma/migrations/<novo>_perfil_e_desativacao`, `src/auth/auth.guard.ts` (e `auth.module.ts` só se precisar do `PrismaService`, que já é global). Arquivos novos em `src/me/` (módulo, controller, service, DTO).
- **Estimativa:** ~150 linhas de produção.
- **Como desfazer:** antes do merge, fechar o PR. Depois do merge, um PR que reverte o código (o que traz de volta os três testes de caracterização antigos) e acrescenta a migration inversa, nesta ordem:
  1. `ALTER TABLE users DROP COLUMN sex, DROP COLUMN birth_date, DROP COLUMN height_cm, DROP COLUMN timezone, DROP COLUMN deactivated_at;`
  2. `DROP TYPE "Sex";`

  Perde só os dados de perfil e as desativações; nada depende deles ainda.
- **Pré-mortem:**
  - O guard passa a dar 401 para todo mundo (consulta errada ou `sub` lido do lugar errado). Coberto: toda a suíte e2e usa tokens de login; ela quebraria inteira.
  - Usuário de verdade fica trancado. Só acontece com `deactivated_at` preenchido, e não há rota que preencha.
  - Uma consulta a mais por pedido. É busca pela chave primária; não medido sob carga.
  - O fuso aceito depende da versão do ICU do Node, e as versões diferem: local v26, CI Node 24 (`.github/workflows/ci.yml`) e produção `node:24-alpine` (`Dockerfile`). Um fuso criado há pouco pode ser recusado no 24. Mitigação: os testes usam só nomes estáveis e nenhum alias, e o nome é gravado como veio.
- **Segurança (skill `seguranca`, tipo API):**
  - **Autenticação:** aplica-se. O guard recusa inexistente e desativado (C7, C8); a mensagem é a mesma dos outros 401 (C7, C8 conferem o texto). Sem `sub` texto, 401 e não 500 (C8).
  - **Autorização / IDOR:** aplica-se. A rota não recebe id; o usuário vem do token (C5).
  - **Entrada externa:** aplica-se. DTO com whitelist e `forbidNonWhitelisted`; `deactivatedAt` não é gravável pela API (C4).
  - **Dados pessoais:** aplica-se. Nascimento, sexo e altura são dados de saúde: só voltam ao dono (C5), a resposta tem só os 4 campos (C1), e nada disso vai para log (decisão (f)). Verificação: revisão do diff (`git grep -n "Logger\|console\." src` sem uso novo) pelo revisor; hoje `src/` não tem nenhum log.
  - **Segredos:** não se aplica: nada novo; o guard continua usando `JWT_SECRET`.
  - **Dependências:** não se aplica: nenhuma nova (`Intl` é do Node, validação com `class-validator`, já instalado).
  - **Modelo de ameaças curto:**
    - *Ativos:* dados de perfil (saúde) e o acesso de contas desativadas.
    - *Quem ataca:* outro usuário autenticado; alguém com um token antigo de conta desativada.
    - *O que pode dar errado:* ler ou mudar o perfil de outro; continuar usando a API depois de desativado; gravar `deactivatedAt` pela própria API; dados de saúde em log.
    - *Mitigação:* rota sem id (C5); checagem a cada pedido (C7); whitelist no DTO (C4); nenhum log novo (revisão); queda do banco não vira 401 (C9).
- **Dependências novas:** Nenhuma.

## Pontos para confirmar na aprovação
1. O login de um usuário desativado continua devolvendo token (que dá 401 em tudo). Recusar no login fica para a tarefa que criar a rota de desativação.
2. O "hoje" do nascimento é o dia mais adiantado do mundo (UTC+14).
3. Mesma mensagem `"Token inválido"` para inexistente e desativado.

## Validação do humano
Com o app no ar (`docker compose up -d`, `npx prisma migrate deploy` e `npm run start:dev`) e um token de login:
1. `GET /me/profile` → `{"sex":null,"birthDate":null,"heightCm":null,"timezone":"America/Sao_Paulo"}`.
2. `PATCH /me/profile` com `{"sex":"M","birthDate":"1990-05-20","heightCm":178,"timezone":"America/Manaus"}` → 200 com os mesmos valores. Repita o passo 1 e confira.
3. `PATCH /me/profile` com `{"heightCm":300}` → 400.
4. Desative pelo banco: `docker exec treino_postgres psql -U postgres -d exactafitdb -c "UPDATE users SET deactivated_at = now() WHERE email = '<seu e-mail>';"` → `UPDATE 1`. Repita o passo 1 → 401 `{"message":"Token inválido",...}`.
5. Reative: `docker exec treino_postgres psql -U postgres -d exactafitdb -c "UPDATE users SET deactivated_at = NULL WHERE email = '<seu e-mail>';"` → `UPDATE 1`. O passo 1 volta a dar 200 com o mesmo token.

- [ ] Rodei o comportamento e ele faz o que os critérios pedem.
