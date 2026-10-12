# Plano: <título da tarefa>

> Copie para `docs/plans/AAAA-MM-DD-<slug>.md`. O humano aprova antes de o `implementador` começar. O plano preenchido, com o "Resultado" ao concluir, é o registro da tarefa.

## Intenção
<!-- 1–3 frases: o que muda para o usuário/sistema e por quê. -->

## Critérios de aceite
- [ ] <!-- comportamento observável e testável, ex.: "PUT /routine/:id de outro usuário retorna 404" -->
- [ ] Typecheck, testes unitários e lint passam.

## Risco
- **Nível:** baixo | médio | alto
- **Toca zona de risco?** (migrations, schema, `src/auth/`, workflows): sim/não. Qual?
- **O que pode quebrar:**

## Tarefas (um commit cada)
1. <!-- tarefa pequena e verificável -->
2.

## Arquivos a tocar
| Arquivo | Mudança |
|---|---|
| `src/...` | |

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
- [ ] Atualiza: `docs/architecture.md` | `docs/domain.md` | ADR `docs/adr/NNNN-...` <!-- risque o que não vale -->
- [ ] Sem impacto em doc: <!-- motivo; se ficar o texto "<motivo>", a declaração não vale -->

## Fora de escopo
- <!-- o que NÃO será feito nesta tarefa, mesmo que pareça relacionado -->

## Resultado (preencher ao concluir)
- **O que foi feito:**
- **Desvios do plano:** <!-- ou "nenhum" -->
- **Pendências:** <!-- ou "nenhuma" -->
- **PR/commit:**
- **Docs atualizadas:** <!-- arquivos, ou "Sem impacto em doc: <motivo>" -->
