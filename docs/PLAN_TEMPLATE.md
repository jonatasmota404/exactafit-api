# Plano: <título da tarefa>

> Copie para `docs/plans/AAAA-MM-DD-<slug>.md`. O humano aprova antes de o `implementador` começar. O plano preenchido, com o "Resultado" ao concluir, é o registro da tarefa.

Aprovado por: —
Modelo recomendado: <modelo> — <motivo>

## Intenção
<!-- 1–3 frases: o que muda para o usuário/sistema e por quê. -->

## Critérios de aceite
- [ ] <!-- comportamento observável e testável, ex.: "PUT /routine/:id de outro usuário retorna 404" -->
- [ ] Typecheck, testes unitários e lint passam.

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
- Nenhuma. <!-- Se houver: pacote, motivo, aprovação do humano. -->

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
