# Domínio — exactafit-api

> Fonte da verdade para regras de negócio. Agentes **não devem presumir** regras que não estão aqui; na dúvida, perguntar.
> As regras foram extraídas do código da versão da `main` de 2026-10-12 e revisadas pelo humano em 2026-10-12.
>
> **Status das regras:**
> - `CONFIRMADO`: o humano validou o comportamento atual do código.
> - `DECIDIDO (muda o código)`: o humano decidiu algo diferente do que o código faz hoje. Ver "Mudanças de código decorrentes".
> - `ADIADO`: a decisão foi explicitamente adiada.
> - `DECIDIDO (por delegação)`: o humano autorizou aplicar as recomendações da IA sem perguntar caso a caso (a partir do bloco 9). Itens hoje com essa marca: a regra de F4 "pelo menos um dos dois obrigatório" (**não revisada pelo humano**) e o local da mídia em (b) (confirmado pelo humano).
> - `ADIADO (decidir no plano)`: detalhe de implementação que fica para o plano de cada tarefa.
> - `CONFIRMAR(humano)`: regra ainda não validada.

## Visão do produto
Ver também [Decisões de produto (antes pendentes)](#decisões-de-produto-antes-pendentes) e os ADRs em [`adr/`](adr/).

**Quem usa** (palavras do humano): "eu e amigos e talvez outros alunos da academia se der certo pra eu vender o app para as academias." Multiusuário desde o V1 (palavras do humano: "desde o V1 tem que ter multiusuários").

**Problema que resolve** (palavras do humano): "É chato ficar dependendo de ficha de treino [...] a maioria dos apps é chato, depende de você fazer avaliação com professor, queria algo que você se matricula, baixa, monta uma ficha de treino padrão com IA". O app também ajuda a praticar cardio e exercícios em casa e guarda o histórico.

**Visão futura, fora do V1** (decidido: opção B):
- Acompanhamento humano: a academia paga para o professor avaliar o aluno e montar a ficha dele. Exigiria papel de professor, vínculo professor–aluno e entidade academia. U7 (sem papéis) continua valendo no V1.
- Matrícula numa academia parceira como condição de uso, que é o modelo de receita. Palavras do humano: "tu precisa estar matriculado na academia parceira pra usar, se não eu não ganho dinheiro".

**Dentro do V1** (decidido):
- Ficha de treino padrão gerada por IA (opção A). `TODO(humano)`: qual serviço de IA, o que o usuário informa para gerar a ficha, e aprovação da dependência nova (regra anti-overengineering 3). A IA só pode montar a ficha com exercícios do catálogo.
- Cardio e exercícios em casa (opção A). Cardio registra só o tempo (distância fica fora do V1) e exige campo novo de duração em `SetLog`; exercício sem carga tem carga vazia (S5, S7). Ver "Mudanças de código decorrentes".
- Histórico de treino.

**Mídia do dataset (© Gym visual):** liberada para uso **enquanto o app não for comercial** (decisão do humano). `TODO(humano)`: reconferir a licença da mídia e da "API oficial" **antes de qualquer uso comercial**.

## Decisões de produto (antes pendentes)

### (a) Uso offline e sincronização — DECIDIDO (muda o código)
- **Offline no V1: sim.** Alcance: só registrar o treino (abrir sessão e lançar séries) numa ficha que já estava no aparelho. Fichas e catálogo são só leitura offline.
- **Sentido do sincronismo:** do aparelho para a API (sessões e séries). Os ids são gerados no cliente e o envio precisa poder repetir sem duplicar.
- **Conflito com S3:** se o sincronismo trouxer mais de uma sessão aberta do mesmo usuário, a API aceita todas e deixa aberta a de `startedAt` mais recente, encerrando as demais (critério revisado em 2026-10-12; o inicial era a ordem de chegada, que encerrava a sessão de hoje quando uma esquecida chegava tarde). Exceção de S3 só para o sincronismo.
- **Datas:** o aparelho envia `startedAt` e `finishedAt` (S1 muda; hoje é `now()` do servidor).
- **Resolvido depois:** `finishedAt` das encerradas = `startedAt` (S3); a data do cliente não é validada (S1); datas em UTC; duplicata de série evitada pelo id do cliente e pela constraint de S8.
- Formato do endpoint de sincronismo: `ADIADO (decidir no plano)`.
- ADR: [0004](adr/0004-uso-offline-e-sincronizacao.md).

### (b) Dataset de exercícios — DECIDIDO (muda o código)
- **Carga repetível:** cada exercício oficial guarda o identificador que tinha no dataset. O script insere o que é novo e atualiza o que já existe, sem duplicar.
- **Mídia:** a API não expõe a mídia publicamente; ela é entregue apenas a usuário autenticado e a todos os autenticados desde já, sem chave que a desligue (decidido: opção B). A atribuição "© Gym visual — https://gymvisual.com/" acompanha toda entrega.
- **Licença da mídia e da "API oficial"** (decisão do humano): liberada para uso **enquanto o app não for comercial**; a condição "não comercial" faz parte da decisão. `TODO(humano)`: reconferir a licença antes de qualquer uso comercial.
- **Onde a mídia fica** (~299 MB, `DECIDIDO (por delegação)`, confirmado pelo humano): volume na VPS servido pelo proxy do Coolify, fora do git e fora do banco; o banco guarda só o caminho. `TODO(humano)`: como a exigência "só usuário autenticado" é aplicada quando o proxy serve o arquivo direto.
- **Idioma das instruções** (decisão do humano): inglês e português, com **português como padrão**. O dataset não tem português (traz en e outros 9 idiomas, sem pt), então a tradução precisa ser produzida. `TODO(humano)`: como produzir a tradução e quem revisa; tradução do nome dos exercícios e dos 10 valores de `muscleGroup`.
- **Fonte** (palavras do humano): "eu já tenho o dataset no meu computador baixado, vamos usar ele. Quando o app crescer e for usado comercialmente eu só viro a chave e pago a licença da API oficial." Caminho local: `/home/jonatas/Projetos/exercices-dataset/exercises-dataset/` (fora deste repositório).
- **Formato** (lido de `data/exercises.json` e `exercises.schema.json`): lista com 1324 exercícios. Campos: `id` (texto de 4 dígitos, único), `name` (inglês), `category` (igual a `body_part`), `body_part` (10 valores: back, cardio, chest, lower arms, lower legs, neck, shoulders, upper arms, upper legs, waist), `equipment` (28 valores), `target` (19 valores), `muscle_group`, `secondary_muscles`, `instructions` e `instruction_steps` em 10 idiomas (en, es, it, tr, ru, zh, hi, pl, ko, fr; **não há português**), `media_id`, `image` (jpg 180×180), `gif_url` (gif 180×180), `attribution`, `created_at`. Não existe campo equivalente a `type` (força/cardio), nem nível ou força.
- **Licença** (lida de `LICENSE` e `NOTICE.md` do dataset): os dados (nomes, categorias, instruções) são MIT, uso comercial permitido mantendo o aviso de copyright. A **mídia** (`images/`, `videos/`) é © Gym visual, fora da MIT: 180×180 apenas, atribuição "© Gym visual — https://gymvisual.com/" obrigatória em todo uso, regida pelos termos da Gym visual, e "clonar o repositório não concede licença da mídia". Se existe uma "API oficial" e qual o custo: **não verificado**.
- **Fonte única da verdade** (palavras do humano): "por enquanto vamos assumir o dataset que eu lhe mandei como fonte única da verdade, isso fica um problema para o futuro quando for comercial usar outro dataset oficial." Trocar de dataset ou de licença da mídia fica **adiado**, sem desenho agora.
- Campo de `muscleGroup`: `body_part` (E4). Pendências da mídia e do idioma estão acima.
- ADR: [0005](adr/0005-carga-do-dataset-de-exercicios.md).

### (c) Alimentação — DECIDIDO
- **Fora do V1.** Visão futura, sem schema nem regras.

## Glossário
| Termo | Definição | Nome no código |
|---|---|---|
| Usuário | Pessoa com conta (e-mail e senha) que monta fichas e registra treinos. Todos têm as mesmas permissões no V1. É desativado por padrão e só é apagado a pedido do titular, por fluxo explícito de exclusão de conta. | `User` |
| Exercício | Item do catálogo, que é **fechado**: vem só do dataset oficial; usuários não criam exercícios. Tem nome e grupo muscular. (**Revisão em 2026-10-14**, [ADR 0009](adr/0009-catalogo-de-exercicios-fechado.md). Antes: item do catálogo oficial ou criado pelo usuário, pertencendo só a ele.) | `Exercise` |
| Catálogo oficial | Conjunto global e somente leitura de exercícios vindo do dataset local; é o **único** catálogo (fechado). Cada exercício guarda o id que tinha no dataset. (**Revisão em 2026-10-14**, [ADR 0009](adr/0009-catalogo-de-exercicios-fechado.md). Antes: convivia com exercícios do usuário, e o nome no código era `Exercise` sem dono, a criar.) | `Exercise` (sem dono) |
| Ficha de treino | Plano do usuário: nome, descrição opcional e itens ordenados (até 50). Até 10 fichas **ativas** por usuário; é arquivada e não é apagada (só no fluxo de exclusão de conta). Sem itens, é rascunho. | `WorkoutRoutine` |
| Item da ficha | Um exercício dentro da ficha, com ordem, número de séries-alvo e repetições-alvo. | `RoutineItem` |
| Sessão de treino | Um treino realizado a partir de uma ficha. Fica aberta enquanto `finishedAt` estiver vazio. Início e fim vêm do aparelho. | `WorkoutSession` |
| Série registrada | Um registro dentro da sessão: exercício, número da série e (opcionais) repetições, carga e duração. Pode ser corrigida, nunca apagada. | `SetLog` |
| Série falhada | Série em que não completei as repetições planejadas. Informada pelo usuário. | `SetLog.failed` |
| Carga | Peso em kg, `Decimal(6,2)`. Vazia significa sem carga. | `SetLog.weightKg` |
| Grupo muscular | Um dos 10 valores de `body_part` do dataset: back, cardio, chest, lower arms, lower legs, neck, shoulders, upper arms, upper legs, waist. `cardio` define o exercício de cardio. | `Exercise.muscleGroup` |
| Sincronismo | Envio, do aparelho para a API, das sessões e séries registradas offline, com ids gerados no cliente. | não existe |

## Regras de negócio

### Usuários e acesso
| # | Regra | Onde | Status |
|---|---|---|---|
| U1 | O e-mail é único e **normalizado** (trim + minúsculas) antes de gravar e de comparar. Hoje o código não normaliza. Cadastro com e-mail existente → 409. | `auth.service.ts`, DTOs | `DECIDIDO (muda o código)` |
| U2 | Nome obrigatório, até 100 caracteres. E-mail válido, até 255. | `register.dto.ts` | `CONFIRMADO` |
| U3 | **Cadastro:** senha com **mínimo de 8** caracteres (hoje o código exige 6) e máximo de 72 **caracteres** (limite do bcrypt, confirmado; o bcrypt conta bytes e ignora o excedente em silêncio, risco aceito). **Login:** a senha só precisa ser **não vazia**, com máximo de 72; o mínimo de 8 **não** vale no login (hoje o login exige mínimo 6). Contas com senha de 6–7 caracteres continuam entrando. **Revisão em 2026-10-12.** Antes: o login também exigia mínimo de 8, e contas de 6–7 caracteres ficavam sem acesso e, sem troca de senha, sem como voltar. Depois: mínimo de 8 só no cadastro. Ver [ADR 0008](adr/0008-minimo-de-senha-so-no-cadastro.md). | `register.dto.ts`, `login.dto.ts` | `DECIDIDO (muda o código)` |
| U4 | A senha é guardada como hash bcrypt (custo 10) e nunca volta em resposta da API. Como evitar devolver o `password` (hoje removido à mão no cadastro) é decisão de implementação, no plano. | `auth.service.ts` `create` | `CONFIRMADO` |
| U5 | Login com e-mail inexistente e login com senha errada dão **respostas diferentes**, ambas 401 (hoje as duas são 401 `"Credenciais inválidas"`). Texto exato: `ADIADO (decidir no plano)`; sugestão da IA, não confirmada: "E-mail não cadastrado" e "Senha incorreta". `TODO(humano)`: reavaliar a resposta genérica (que não revela se o e-mail existe) se o app for aberto a terceiros; exigiria mudar também o 409 do cadastro (U1). O cadastro já revela se o e-mail existe (409), então a separação não abre um vazamento novo. | `auth.service.ts` `login` | `DECIDIDO (muda o código)` |
| U6 | O token é um JWT com `sub` = id do usuário e `email`, válido por 7 dias, sem refresh nem revogação. A decisão sobre expiração e refresh fica para a fase do front. Reconfirmado adiado mesmo com o offline do V1: aparelho com mais de 7 dias sem sincronizar recebe 401 e precisa de novo login antes de enviar (risco aceito). | `auth.module.ts`, `auth.service.ts` | `ADIADO` |
| U7 | Não existem papéis: todo usuário autenticado tem as mesmas permissões no V1 (professor e academia ficam fora do V1). | ausência no código | `CONFIRMADO` |
| U8 | A aplicação não sobe sem `JWT_SECRET` nem com valor de **menos de 32 caracteres** (decidido em 2026-10-18; base: RFC 7518 §3.2 para HS256). A mensagem de erro não mostra o valor. Implementado em 2026-10-18 (`fix/jwt-secret-obrigatorio`, plano `docs/plans/2026-10-18-jwt-secret-e-shutdown.md`); antes usava um segredo fixo de reserva. Deploy no V1: VPS própria. `JWT_SECRET` é variável de ambiente do serviço no Coolify, **somente em runtime** (não em build), com cópia do valor em gerenciador de senhas; nunca no repositório. A API **ainda não está em produção**: não há tokens emitidos nem segredo a migrar ao remover o fallback. | `auth.module.ts` | `CONFIRMADO` |

### Exercícios
| # | Regra | Onde | Status |
|---|---|---|---|
| E1 | O catálogo de exercícios é **fechado**: vem só do dataset oficial ([ADR 0005](adr/0005-carga-do-dataset-de-exercicios.md)), é global e todos os usuários veem o mesmo catálogo. Usuários não criam exercícios. Hoje nenhum exercício tem dono, todos veem todos e qualquer usuário autenticado cria exercício por `POST /exercises`. Motivo (palavras do humano): "pode dar problema, é melhor ter uma base fixa de exercícios que o proprietário do sistema atualize e seja uma base comum para todos." **Revisão em 2026-10-14** ([ADR 0009](adr/0009-catalogo-de-exercicios-fechado.md)). Antes: catálogo oficial global e somente leitura + exercício criado por usuário pertencendo só a ele, implementação no V1 ([ADR 0003](adr/0003-catalogo-oficial-e-exercicios-do-usuario.md), substituído). Depois: catálogo fechado, sem exercício do usuário. | `schema.prisma`, `exercises.service.ts` | `DECIDIDO (muda o código)` |
| E2 | Usuários **não criam, não editam e não removem** exercícios (E1). Hoje qualquer usuário autenticado cria exercício por `POST /exercises`, que entra no catálogo de todos; não há `PUT` nem `DELETE`. O destino de `POST /exercises` (remover, ou restringir a quem carrega o dataset) é pergunta aberta: ver P1 em "Decisões pendentes". **Revisão em 2026-10-14** ([ADR 0009](adr/0009-catalogo-de-exercicios-fechado.md)). Antes: qualquer usuário criava exercícios que pertenciam só a ele, e editava e removia os próprios (opção A); exercício oficial ou de outro usuário dava 404; remoção recusada (409) com séries ou em ficha. Depois: nenhuma escrita de exercício por usuário. | `exercises.controller.ts` | `DECIDIDO (muda o código)` |
| E3 | `name` obrigatório, até 100 caracteres. No dataset o maior nome tem 67. | `create-exercises.dto.ts` | `CONFIRMADO` |
| E4 | `muscleGroup` aceita só os 10 valores de `body_part` do dataset: back, cardio, chest, lower arms, lower legs, neck, shoulders, upper arms, upper legs, waist (hoje é texto livre). O campo `type` **sai**: o cardio é decidido por `muscleGroup = cardio` (o dataset não tem `type`; antes ele tinha padrão `strength`). Quem ainda enviar `type` no `POST /exercises` recebe 400. `TODO(humano)`: tradução dos valores para o app. | `create-exercises.dto.ts`, `schema.prisma` | `DECIDIDO (muda o código)` |
| E5 | Nomes duplicados são permitidos (no dataset, 6 nomes se repetem). | ausência de `@unique` | `CONFIRMADO` |
| E6 | Um exercício com séries registradas não pode ser apagado; um que está em ficha também não (C3). Ver [ADR 0001](adr/0001-exclusao-sem-cascata-de-historico.md). Não há rota de remoção de exercício por usuário (E2). Se a atualização do dataset pode remover exercício do catálogo: pergunta aberta (P2). **Revisão em 2026-10-14** ([ADR 0009](adr/0009-catalogo-de-exercicios-fechado.md)). Antes: a proteção também valia para a remoção do próprio exercício pelo usuário (E2, 409). Depois: vale para qualquer remoção de exercício; usuário não remove exercício. | `schema.prisma` (hoje cascade) | `DECIDIDO (muda o código)` |

### Fichas de treino
| # | Regra | Onde | Status |
|---|---|---|---|
| F1 | Uma ficha pertence ao usuário do token. Um usuário só lista, lê e altera as próprias fichas. A ficha de outro usuário responde 404. **Trade-offs aceitos:** (1) 404 em vez de 403 esconde que a ficha existe, mas o app não distingue "não existe" de "não é sua". (2) Sem compartilhamento no V1: amigo não vê nem copia a ficha, e o professor montar a ficha do aluno (visão futura) exigirá exceção a F1. (3) Hoje o `PUT` checa a posse fora da transação e escreve filtrando só por `id`, o que foge da convenção "toda query filtra por `userId`" (risco de corrida baixo, não verificado em execução). (4) Com o offline, o aparelho pode enviar sessão de ficha já arquivada; ela é aceita (S1). | `routine.service.ts` | `CONFIRMADO` |
| F2 | Nome obrigatório, até 100 caracteres. Descrição opcional, até 255. | `create-routine.dto.ts` | `CONFIRMADO` |
| F2a | `name` só com espaços (`"   "`) é aceito hoje no `POST` e no `PUT`. **ADIADO: tratar junto com a tarefa de F4/F11 (trim do nome no POST e no PUT).** | `create-routine.dto.ts`, `update-routine.dto.ts` | `ADIADO` |
| F2b | `description: null` no `PUT` limpa a descrição (confirmado pelo humano). A validação aceita o `null`; a gravação não foi verificada em execução. Um teste que trave a regra entra na tarefa de F4/F11. | `update-routine.dto.ts`, `routine.service.ts` | `CONFIRMADO` |
| F3 | Ficha sem itens é permitida, como rascunho. "Rascunho" **não** é um estado explícito: é só uma ficha sem itens (decidido: opção A). | `create-routine.dto.ts` | `CONFIRMADO` |
| F4 | `targetSets` de 1 a 20, `targetReps` de 1 a 100 **quando informado**, `order` ≥ 0 (hoje qualquer inteiro passa). Para cardio, o item ganha a duração-alvo em segundos (campo novo, opcional) e `targetReps` passa a ser opcional (decidido: opção A). Pelo menos um dos dois é obrigatório (`DECIDIDO (por delegação)`). `TODO(humano)`: faixa da duração-alvo. | `create-routine.dto.ts` | `DECIDIDO (muda o código)` |
| F5 | O mesmo exercício pode aparecer mais de uma vez na ficha, desde que o `order` seja único. | ausência de constraint | `CONFIRMADO` |
| F6 | O item só aceita exercício do catálogo (E1). Exercício inexistente dá 400 "Exercício não encontrado" (hoje a FK recusa e o erro provavelmente vira 500). Qual item falhou na mensagem: `ADIADO (decidir no plano)`. **Revisão em 2026-10-14** ([ADR 0009](adr/0009-catalogo-de-exercicios-fechado.md)). Antes: aceitava exercício do catálogo oficial ou do próprio usuário, e exercício inexistente e de outro usuário davam a mesma resposta 400. Depois: só catálogo; não existe exercício de outro usuário. | `schema.prisma`, `routine.service.ts` | `DECIDIDO (muda o código)` |
| F7 | Os itens são devolvidos em ordem crescente de `order`, com os dados do exercício. | `routine.service.ts` | `CONFIRMADO` |
| F8 | A atualização é parcial. Se `items` vier, substitui todos os itens, que ganham ids novos. Isso é aceitável porque o histórico (`SetLog`) guarda o `exerciseId` e não depende dos itens da ficha. | `routine.service.ts` `update` | `CONFIRMADO` |
| F9 | A ficha é **arquivada**, nunca apagada. Hoje não há exclusão nem arquivamento. A ficha arquivada pode **voltar a ser ativa** (arquivar e desarquivar). `GET /routine` devolve só as ativas por padrão; as arquivadas só vêm se pedidas e continuam acessíveis pelo id. A ficha arquivada **pode ser editada**. Ver [ADR 0001](adr/0001-exclusao-sem-cascata-de-historico.md). Formato da ação de arquivar/desarquivar: `ADIADO (decidir no plano)`. | `schema.prisma`, `routine.*` | `DECIDIDO (muda o código)` |
| F10 | Limites: **no máximo 10 fichas ativas por usuário** e **no máximo 50 itens por ficha**. A ficha arquivada **não conta** no limite: arquivar libera espaço e o histórico continua guardado (**revisão** da decisão anterior, em que a arquivada contava; confirmada pelo humano). Consequência: fichas arquivadas não têm teto; `TODO(humano)`: se precisa de um. Resposta de erro ao passar do limite: `ADIADO (decidir no plano)`. **F10 só será implementada junto com F9** (campo de arquivamento): nenhuma tarefa implementa F10 antes (decisão do humano). | ausência no código | `DECIDIDO (muda o código)` |
| F11 | O `order` é único dentro da ficha (hoje pode repetir). Só precisa ser única: lacunas são permitidas (decidido: opção A). | `create-routine.dto.ts`, `schema.prisma` | `DECIDIDO (muda o código)` |

### Sessões e séries (só schema; nenhum código usa ainda)
| # | Regra | Onde | Status |
|---|---|---|---|
| S1 | Uma sessão pertence a um usuário e a uma ficha. O início (`startedAt`) e o fim (`finishedAt`) vêm do aparelho, por causa do offline (hoje o início é `now()` do servidor). Sessão de ficha já arquivada é aceita. A API aceita a data enviada sem validar (decidido: opção B; risco aceito: treino no futuro ou duração negativa). Datas em UTC; o app exibe no fuso do aparelho. | `schema.prisma` `WorkoutSession` | `DECIDIDO (muda o código)` |
| S2 | A sessão tem `finishedAt` opcional: vazio significa sessão aberta. Hoje o campo não existe. | `schema.prisma` | `DECIDIDO (muda o código)` |
| S3 | Cada usuário tem no máximo uma sessão aberta. **Exceção do sincronismo:** se chegarem várias abertas, a API aceita todas e fica aberta a de `startedAt` **mais recente**; as demais são encerradas com `finishedAt = startedAt` (duração zero, "encerrada automaticamente"). Isso revisa o critério "última a chegar" inicial (caso de borda 5; custo aceito: depende do relógio do aparelho, que S1 não valida). | — | `DECIDIDO (muda o código)` |
| S4 | Ficha sem itens não pode iniciar sessão **ao iniciar online**. O sincronismo aceita a sessão mesmo que a ficha tenha ficado vazia depois (decidido: opção A; o treino já aconteceu). | — | `DECIDIDO (muda o código)` |
| S5 | Uma série registrada tem `setNumber`, `failed` (padrão `false`) e referencia um exercício. `repsCompleted`, `weightKg` e a duração (segundos, só para cardio; campo novo) são **opcionais**. A API não valida o que cada série precisa ter: uma série vazia é aceita e os relatórios devem tolerar (decidido: opção B). Cardio registra só tempo; distância fica fora do V1. Os ids das séries e das sessões são gerados no cliente (offline). | `schema.prisma` `SetLog` | `DECIDIDO (muda o código)` |
| S6 | `failed` = série em que não completei as repetições planejadas. O valor é **informado pelo usuário**; a API não confere com `repsCompleted` (risco aceito: pode contradizer). Ver [ADR 0002](adr/0002-definicao-de-serie-falhada.md). | `SetLog.failed` | `DECIDIDO` |
| S7 | A carga é em kg, `Decimal(6,2)` (0,00 a 9999,99). Vazia significa sem carga (peso do corpo). Hoje é `Float`. | `SetLog.weightKg` | `DECIDIDO (muda o código)` |
| S8 | O número da série é único por sessão e exercício (constraint no banco; duplicata dá 409). O app continua a numeração quando o mesmo exercício reaparece na ficha (F5). No sincronismo, uma série em conflito não derruba o lote. Série de exercício que **não está na ficha** da sessão é aceita, desde que o exercício exista no catálogo (**revisão em 2026-10-14**, [ADR 0009](adr/0009-catalogo-de-exercicios-fechado.md); antes: "exista e seja visível ao usuário (oficial ou próprio)"); relatórios devem tolerar série sem item correspondente (decidido: opção A). | `schema.prisma` | `DECIDIDO (muda o código)` |
| S9 | O usuário **corrige** série e sessão registradas (atualização por id), mas **nunca apaga** (decidido: opção A). Uma sessão registrada **nunca é apagada**; erro se corrige editando a sessão. Motivo: com sincronização offline, apagar uma sessão exigiria um marcador de exclusão, e um aparelho antigo poderia ressuscitá-la. Uma sessão aberta por engano se encerra. Uma sessão encerrada **não reabre**: `finishedAt`, depois de preenchido, não volta a vazio (decidido: opção A; encerrar por engano obriga a abrir sessão nova). | rotas novas | `DECIDIDO (muda o código)` |

### Exclusão (ver [ADR 0001](adr/0001-exclusao-sem-cascata-de-historico.md))
| # | Regra | Status |
|---|---|---|
| C1 | O usuário **nunca é apagado**, só desativado (decidido: opção B). `User` ganha um campo de desativação e as FKs de `User` viram restrição. O `AuthGuard` passa a verificar se o usuário **existe e está ativo** a cada pedido e recusa com 401 o inexistente e o desativado, mesmo com token válido (decidido: opção A; custo: uma consulta por requisição, toca `src/auth/`). Hoje o guard só verifica a assinatura e não consulta o banco (confirmado por teste de caracterização, `test/authguard-caracterizacao.e2e-spec.ts`): um usuário desativado continuaria acessando por até 7 dias, a validade do token (U6). O e-mail do desativado continua ocupado (cadastro com ele dá 409). **Exceção:** a pedido do titular, um fluxo explícito de **exclusão de conta apaga todos os dados do usuário** (decisão do humano; sem texto jurídico). Como as FKs são restrição (C3), o fluxo roda numa transação que remove antes séries, sessões, itens e fichas, e depois o usuário. Exercícios não são apagados: são do catálogo, sem dono (E1). **Revisão em 2026-10-14** ([ADR 0009](adr/0009-catalogo-de-exercicios-fechado.md)). Antes: a exclusão apagava também os exercícios criados pelo usuário (`Exercise.userId` em cascata). Depois: não há exercício do usuário nem `Exercise.userId`. `TODO(humano)`: o processo (canal de contato e prazo), antes de haver usuários de terceiros. | `DECIDIDO (muda o código)` |
| C2 | Histórico (sessões e séries) nunca é apagado em cascata. Fichas são arquivadas (F9). Hoje apagar uma ficha apaga as sessões e séries dela. | `DECIDIDO (muda o código)` |
| C3 | Um exercício com séries registradas **ou em alguma ficha** não pode ser apagado (E6). FKs que viram restrição: `SetLog.exerciseId`, `RoutineItem.exerciseId`, `WorkoutSession.routineId`, `SetLog.sessionId`, `WorkoutSession.userId`, `WorkoutRoutine.userId`. `RoutineItem.routineId` continua cascade. **Revisão em 2026-10-14** ([ADR 0009](adr/0009-catalogo-de-exercicios-fechado.md)). Antes: citava E2 e o 409 na remoção do próprio exercício, e previa a FK nova `Exercise.userId` (dono) em cascata, disparada só na exclusão de conta. Depois: sem rota de remoção por usuário e sem `Exercise.userId`. | `DECIDIDO (muda o código)` |

### Progressão e métricas
- O código não faz nenhum cálculo (volume, 1RM, progressão). **Fora do V1** (decidido: opção A): a API só guarda e devolve o histórico, que é preservado, e qualquer métrica pode ser calculada depois sobre os mesmos dados. Se a ficha por IA precisar de uma métrica para adaptar a próxima ficha, isso precisa ser reaberto.
- Fuso horário: datas em UTC (`TIMESTAMP(3)` sem fuso); o app exibe no fuso do aparelho (decidido: opção A). "Treinos por dia" precisa do fuso do aparelho em cada pedido ou fica por UTC.

## Invariantes (devem sempre ser verdade)
1. Um usuário nunca lê nem altera a ficha de outro (F1). `CONFIRMADO`
2. A senha nunca é devolvida em resposta da API (U4). `CONFIRMADO`
3. Histórico de sessões e séries nunca é apagado em cascata (C2); só o fluxo de exclusão de conta a pedido do titular apaga histórico (C1). `DECIDIDO`
4. Cada usuário tem no máximo uma sessão aberta (S3), valendo depois de cada sincronismo, que encerra as excedentes. `DECIDIDO`
5. O `order` é único dentro de cada ficha; lacunas são permitidas (F11). `DECIDIDO`
6. Usuários nunca criam, alteram nem apagam exercícios; o catálogo vem só do dataset (E1, E2). `DECIDIDO` (**revisão em 2026-10-14**; antes: "O catálogo oficial nunca é alterado nem apagado pela API")
7. Um item de ficha e uma série só referenciam exercício do catálogo (F6, S8). `DECIDIDO` (**revisão em 2026-10-14**; antes: "do catálogo oficial ou do próprio usuário")
8. Série e sessão registradas nunca são apagadas, só corrigidas (S9), exceto pela exclusão de conta (C1). `DECIDIDO`
9. O usuário é desativado, não apagado, exceto pelo fluxo de exclusão de conta a pedido do titular (C1). `DECIDIDO`
10. Um usuário tem no máximo 10 fichas ativas, e uma ficha tem no máximo 50 itens (F10). `DECIDIDO`
11. O número da série é único por sessão e exercício (S8). `DECIDIDO`

## Casos de borda conhecidos (comportamento atual, não verificado em execução)
Cada caso virou correção, validação ou comportamento aceito. Os casos foram decididos com o humano; o 6 começou por delegação e foi depois **confirmado** por ele.

| # | Caso | Decisão |
|---|---|---|
| 1 | `PUT /routine/:id` com `"name": null` passava na validação e falhava no Prisma (500). | **Resolvido:** `null` e `''` em `name` no `PUT` dão 400. Filtrar por `userId` na escrita (F1, trade-off 3) é tarefa separada. |
| 2 | `exerciseId` inexistente em `POST` ou `PUT /routine` gera erro de FK não tratado (provável 500). | **Resolvido por F6:** 400 para exercício inexistente (revisão em 2026-10-14; antes também "de outro usuário", que deixou de existir com o catálogo fechado). |
| 3 | Dois cadastros simultâneos com o mesmo e-mail: um deles provavelmente recebe 500 em vez de 409. | **Correção:** a violação de unicidade do banco responde 409. |
| 4 | `Joao@x.com` e `joao@x.com` são contas diferentes. | **Resolvido por U1:** e-mail normalizado. |
| 5 | Sessão antiga esquecida aberta, sincronizada tarde, encerrava a sessão de hoje. | **Resolvido em S3:** vence a de `startedAt` mais recente. |
| 6 | Login sem limite de tentativas; com as mensagens separadas de U5, permite descobrir e-mails e tentar senhas sem teto. | **Correção (confirmada pelo humano):** no máximo **5 tentativas por 15 minutos, por e-mail e IP**. Revisão: o humano pediu também resposta genérica, mas manteve U5 (mensagens separadas); reavaliar a resposta genérica se o app for aberto a terceiros (`TODO(humano)`, ver U5). Se a implementação exigir dependência nova, ela **precisa da aprovação do humano no plano**. |

## Decisões pendentes
Perguntas ao dono, **sem decisão**. Nenhuma tarefa presume a resposta.

| # | Pergunta | Origem | Status |
|---|---|---|---|
| P1 | O que acontece com `POST /exercises`: remover, ou restringir a quem carrega o dataset? | E1, E2, [ADR 0009](adr/0009-catalogo-de-exercicios-fechado.md) | `TODO(humano)` |
| P2 | Como o dataset é atualizado depois do V1? | E1, E6, (b), [ADR 0009](adr/0009-catalogo-de-exercicios-fechado.md) | `TODO(humano)` |

## Mudanças de código decorrentes
Nada disso está implementado, salvo onde a linha diz "Implementado". Cada item precisa de plano (`docs/PLAN_TEMPLATE.md`) aprovado antes. O risco é **baixo**, **médio** ou **alto**.

| Regras | O que muda | Risco |
|---|---|---|
| U1, caso 4 | Normalizar o e-mail (trim + minúsculas) no cadastro e no login. Antes de mudar, verificar se o banco já tem e-mails que colidem depois de normalizados. | **Médio**: toca `src/auth/`; dados existentes podem colidir. |
| U3 | `@MinLength(8)` só em `register.dto.ts`. Em `login.dto.ts`, trocar `@MinLength(6)` por `@IsNotEmpty()`, mantendo `@MaxLength(72)`. Ver [ADR 0008](adr/0008-minimo-de-senha-so-no-cadastro.md). | **Baixo**: só validação, mas toca `src/auth/`. O login fica mais permissivo e contas de 6–7 caracteres continuam entrando; só cadastros novos com menos de 8 recebem 400. |
| U5 | Respostas 401 distintas para e-mail inexistente e senha errada. Texto exato no plano. | **Baixo**: toca `src/auth/`, mudança de mensagem. |
| U8 | **Implementado em 2026-10-18** (`fix/jwt-secret-obrigatorio`), com mínimo de 32 caracteres. Remover o fallback fixo em `auth.module.ts` e falhar na inicialização sem `JWT_SECRET`. (`dotenv` já é dependência direta: `package.json:35`.) `JWT_SECRET` como variável de ambiente do serviço no Coolify, só em runtime, com cópia em gerenciador de senhas. Não há tokens nem segredo a migrar (a API não está em produção). | **Médio**: toca `src/auth/`; quebra ambientes sem a variável (desenvolvimento, CI, e2e). |
| Caso 3 | Tratar a violação de unicidade no cadastro e responder 409. | **Baixo**: toca `src/auth/`. |
| Caso 6 | Limite de 5 tentativas por 15 minutos, por e-mail e IP, no login. Mecanismo no plano; se exigir dependência nova, precisa da aprovação do humano. | **Médio**: toca `src/auth/`; pode bloquear usuário legítimo; possível dependência nova. |
| C1 | Campo de desativação em `User` + migration; FKs de `User` viram restrição. | **Médio**: schema e migration; muda o comportamento de exclusão (ver C3). |
| C1 (AuthGuard) | O `AuthGuard` passa a consultar o usuário a cada pedido e recusar com 401 o inexistente e o desativado. Hoje só verifica a assinatura. Depende do campo de desativação da linha anterior. **Plano próprio**; não implementado. | **Médio**: toca `src/auth/` (zona de risco); uma consulta a mais por requisição; o teste de caracterização que afirma o comportamento atual (aceita token de usuário inexistente) passa a falhar de propósito. |
| E1 (`Exercise.userId`) | **Revisão em 2026-10-14** ([ADR 0009](adr/0009-catalogo-de-exercicios-fechado.md)). Antes: dono opcional em `Exercise` (`userId`, FK em cascata; nulo = catálogo oficial), filtro de `GET /exercises` por dono e `userId` gravado no `POST`. Depois: `Exercise` **não ganha** `userId` (hoje a coluna não existe: `prisma/schema.prisma:14-26`); `GET /exercises` continua devolvendo o mesmo catálogo para todos. Continua: coluna do id do dataset + migration (ver (b)). Exercícios já criados por usuários no banco (sem id do dataset) precisam de destino no plano; a API não está em produção (U8). | **Baixo**: remove trabalho planejado; a migration do id do dataset continua sendo schema (zona de risco). |
| E2 (`POST /exercises`) | **Revisão em 2026-10-14** ([ADR 0009](adr/0009-catalogo-de-exercicios-fechado.md)). Antes: rotas `PUT` e `DELETE` de exercício do próprio usuário (404/409). Depois: **não criar** `PUT` nem `DELETE`; usuário deixa de criar exercício. O que fazer com `POST /exercises` (remover, ou restringir a quem carrega o dataset) depende de P1 e **não está decidido**; nenhuma tarefa mexe na rota antes da resposta. | **Médio**: remover a rota quebra quem a usa (e o teste de caracterização); restringir exige algum critério de quem pode escrever, e U7 diz que não há papéis no V1 (pode tocar `src/auth/`). |
| E1, E2 (testes de caracterização) | **Novo em 2026-10-14** ([ADR 0009](adr/0009-catalogo-de-exercicios-fechado.md)). `test/exercises-caracterizacao.e2e-spec.ts`: o teste "E1/E2: exercício criado pelo usuário A aparece na listagem do usuário B" (linha 206) trava "todos veem todos" como divergência, mas com o catálogo fechado ver o mesmo catálogo **deixa de ser divergência**; a divergência passa a ser o usuário criar exercício. O comentário da linha 205 ficou desatualizado. Os testes do bloco `POST /exercises` (linhas 90–160) e o de rotas inexistentes (linha 187) mudam conforme a resposta de P1. Rever na tarefa que implementar E2, não antes. | **Baixo**: só testes; risco de travar a regra errada se mudarem antes de P1. |
| E4 | `muscleGroup` limitado aos 10 valores de `body_part` (enum no schema ou `@IsIn`, a decidir no plano). **Remover** a coluna `type` e o campo do DTO. Cardio = `muscleGroup = cardio`. | **Alto**: a migration apaga uma coluna e quebra quem envia `type` (400); dados fora da lista quebram a migration. |
| E6, C2, C3 | Seis FKs de cascade para restrição: `SetLog.exerciseId`, `RoutineItem.exerciseId`, `WorkoutSession.routineId`, `SetLog.sessionId`, `WorkoutSession.userId`, `WorkoutRoutine.userId`. `RoutineItem.routineId` continua cascade. | **Médio**: migration em FK; muda o comportamento de exclusão. |
| F1 (trade-off 3) | `PUT /routine/:id`: filtrar por `userId` na própria escrita, dentro da transação. **Tarefa separada** do caso 1. | **Baixo**: muda a escrita do `update`; cobrir com teste de ficha de outro usuário. |
| F4 | `targetSets` 1–20, `order` ≥ 0, `targetReps` 1–100 quando informado. Em `RoutineItem`, `targetReps` passa a opcional e entra a duração-alvo em segundos (opcional) + migration. Pelo menos um dos dois obrigatório (decidido por delegação). Faixa da duração: `TODO(humano)`. | **Médio**: schema; requisições que hoje passam recebem 400. |
| F6 | Ao salvar item, conferir que o exercício existe no catálogo; senão 400. (**Revisão em 2026-10-14**, [ADR 0009](adr/0009-catalogo-de-exercicios-fechado.md); antes: "existe e é oficial ou do usuário".) | **Baixo**: uma consulta a mais. |
| F9 | Campo de arquivamento em `WorkoutRoutine` (nulo = ativa) + migration; ação de arquivar e desarquivar; `GET /routine` devolve só as ativas por padrão. | **Médio**: schema e contrato da listagem. |
| F10 | Limites de 10 fichas **ativas** por usuário (arquivadas não contam) e 50 itens por ficha; erro ao passar. **Só junto com F9**: nenhuma tarefa implementa F10 antes. | **Baixo** em si; **dependente de F9** (o limite de ativas precisa do campo de arquivamento). |
| F11 | Constraint única (`routineId`, `order`) + migration. Lacunas permitidas. | **Médio**: a migration falha se já houver `order` repetido. |
| S1, S2 | `startedAt` e `finishedAt` (opcional) enviados pelo aparelho + migration. | **Baixo**: nenhum código usa sessões ainda. |
| S3 | Uma sessão aberta por usuário. No sincronismo: aceitar todas, manter a de `startedAt` mais recente, encerrar as demais com `finishedAt = startedAt`, numa transação. | **Alto**: concorrência; índice parcial em SQL; regra de exceção. |
| S4 | Rejeitar ficha sem itens só ao iniciar online. Depende do módulo `sessions` (`wip/sessions`). | **Baixo**. |
| S6 | No registro de série (módulo `sessions`, `wip/sessions`), aceitar `failed` no body e gravar o valor recebido, sem calcular. Melhoria futura possível, não decidida: gravar em `SetLog` um snapshot de `targetReps` (exigiria schema e migration). | **Baixo**: nenhum código usa `SetLog` na `main`. |
| S5, S7 | `SetLog`: `weightKg` de `Float` para `Decimal(6,2)` opcional; `repsCompleted` opcional; duração em segundos opcional. | **Baixo**: nenhum código usa `SetLog` ainda; `Decimal` muda a serialização no JSON. |
| S8 | Constraint única (`sessionId`, `exerciseId`, `setNumber`); 409 na duplicata; um conflito não derruba o lote do sincronismo. | **Baixo**: tabela sem uso por código. |
| S9 | Rotas de atualização por id para sessão e série; **sem rota de exclusão de sessão nem de série** (apagar exigiria marcador de exclusão no sincronismo); `finishedAt` preenchido não volta a vazio. | **Médio**: rotas novas com regras de posse; a ausência de exclusão é regra, não omissão. |
| (a) Offline | Endpoint de sincronismo; ids de sessão e série gerados no cliente; envio idempotente. Ver [ADR 0004](adr/0004-uso-offline-e-sincronizacao.md). | **Alto**: contrato novo, idempotência e concorrência. |
| (b) Dataset | Script repetível de carga do dataset local (id do dataset como chave); referência de mídia em `Exercise`; entrega de mídia só a usuário autenticado, com a atribuição. Ver [ADR 0005](adr/0005-carga-do-dataset-de-exercicios.md). | **Alto**: carga de 1324 registros, mídia de ~299 MB em volume na VPS servido pelo proxy do Coolify, caminho no banco; licença liberada só para uso não comercial. |
| Ficha por IA | Endpoint que gera ficha com exercícios do catálogo, respeitando F4, F6 e F10. Ver [ADR 0007](adr/0007-ficha-por-ia-no-v1.md). | **Alto**: serviço externo, dependência nova (precisa de aprovação), custo por uso, dados do usuário saem da API. |
| Cardio | Ver S5, S7, F4 e E4. Ver [ADR 0006](adr/0006-cardio-no-v1-e-remocao-do-type.md). | incluído nas linhas acima |
| Exclusão de conta (C1) | Fluxo explícito, a pedido do titular, que apaga todos os dados do usuário. Numa transação: remove antes séries, sessões, itens e fichas (FKs de restrição) e depois o usuário. Não apaga exercícios. Processo (canal e prazo): `TODO(humano)`. **Revisão em 2026-10-14** ([ADR 0009](adr/0009-catalogo-de-exercicios-fechado.md)). Antes: apagava também os exercícios do usuário (`Exercise.userId` em cascata). | **Alto**: apaga histórico de forma irreversível; interage com as FKs de restrição de C3; a ordem errada falha por violação de FK. (Antes também apagava exercícios; esse risco sai.) |
| Idioma (pt/en) | Instruções dos exercícios em inglês e português, com português como padrão. Modelo de dados (colunas, tabela ou JSON por idioma) e API a definir no plano; a tradução do dataset ainda precisa ser produzida, e COMO e por QUEM é `TODO(humano)`. Ver [ADR 0005](adr/0005-carga-do-dataset-de-exercicios.md). | **Alto**: mexe no modelo de `Exercise`, na carga do dataset (1324 exercícios × instruções) e em todas as respostas com instruções; conteúdo traduzido sem revisor definido. |
| Mídia em volume | Volume na VPS servido pelo proxy do Coolify; o banco guarda só o caminho. Configuração de deploy (Coolify) e regra de acesso por usuário autenticado. | **Médio**: infra fora do repositório; a autenticação da mídia direta pelo proxy é `TODO(humano)`. |
