# Plano: <título da tarefa>

> Copie para `docs/plans/AAAA-MM-DD-<slug>.md`. O humano aprova antes de o `implementador` começar. O plano preenchido, com o "Resultado" ao concluir, é o registro da tarefa.

Aprovado por: —
Modelo recomendado: <modelo> — <motivo>

## Intenção
<!-- 1–3 frases: o que muda para o usuário/sistema e por quê. -->

## Critérios de aceite
- [ ] <!-- comportamento observável e testável, ex.: "PUT /routine/:id de outro usuário retorna 404" -->
- [ ] Typecheck, testes unitários e lint passam.

## Testes (escritos antes do código)
<!-- Um teste por critério de aceite que muda comportamento, incluindo o caminho de erro. Só o que o critério pede: sem caso impossível nem detalhe interno.
Risco médio ou alto: o humano aprova esta lista junto com o plano.
Tarefa sem comportamento novo (documentação, configuração, refatoração já coberta por testes): escreva "Sem teste novo: <motivo>". -->
| Critério | Caso (entrada → esperado) | Arquivo de teste |
|---|---|---|
| | | |

## Risco
- **Nível:** baixo | médio | alto
- **Toca zona de risco?** (migrations, schema, autenticação, workflows; lista no `AGENTS.md`): sim/não. Qual?
- **O que pode quebrar:**

## Menor esforço
<!-- Skill menor-esforco. Uma linha: "Menor esforço: considerei <alternativas>; escolhi <X> porque <motivo>". -->

## Segurança (risco médio ou alto)
<!-- Skill seguranca. Só se tocar autenticação, dados pessoais, entrada externa, segredos ou dependências; senão "não se aplica: <motivo>".
- Itens do checklist que se aplicam, como serão verificados:
- Itens que não se aplicam agora, e por quê:
- Risco alto: modelo de ameaças curto (ativos; quem ataca; o que pode dar errado; mitigação) e ADR se difícil de reverter. -->

## Tarefas (um commit cada)
1. <!-- tarefa pequena e verificável -->
2.

## Arquivos a tocar
| Arquivo | Mudança |
|---|---|
| `<caminho>` | |

## Abstrações novas
<!-- Padrão: nenhuma. Se houver, justifique com os DOIS usos reais que já existem. -->
- Nenhuma.

## Dependências novas
<!-- Padrão: `Nenhuma`. Se houver, confira cada pacote no registro oficial ANTES de pedir aprovação (comando e saída colados; ex. npm: `npm view <pacote> name time.created time.modified maintainers license`). Pacote que não existe, com menos de ~30 dias ou com nome parecido com outro muito usado: pare e relate. -->
Nenhuma.

| Pacote | Existe no registro | Primeira/última publicação | Mantenedor | Por que não dá para evitar |
|---|---|---|---|---|
| | | | | |

## Como verificar
```bash
npm run typecheck
npm test
npm run lint:check
# se tocar banco/rotas: docker compose up -d && npx prisma migrate deploy && npm run test:e2e
```
<!-- + passos manuais (curl, etc.), se houver -->

## Documentação (definição de pronto)
<!-- Se a tarefa muda rota, schema, regra de negócio ou módulo: atualize no mesmo commit. Marque um. -->
- [ ] Atualiza: `docs/domain.md` | ADR `docs/adr/NNNN-...` <!-- risque o que não vale -->
- [ ] Sem impacto em doc: <!-- motivo; se ficar o texto "<motivo>", a declaração não vale -->

## Fora de escopo
- <!-- o que NÃO será feito nesta tarefa, mesmo que pareça relacionado -->

## Resultado (preencher ao concluir)
- **O que foi feito:**
- **Desvios do plano:** <!-- ou "nenhum" -->
- **Pendências:** <!-- ou "nenhuma" -->
- **PR/commit:**
- **Docs atualizadas:** <!-- arquivos, ou "Sem impacto em doc: <motivo>" -->

### Para o manual
<!-- Repasse ao curador do manual. -->
- **O que mudou no comportamento:**
- **Decisões novas em domain/ADR:** <!-- IDs, ou "nenhuma" -->
- **O que o humano precisa entender:**
