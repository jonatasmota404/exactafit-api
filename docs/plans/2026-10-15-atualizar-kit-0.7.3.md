# Plano: atualizar o kit de IA de 0.6.0 para 0.7.3

Aprovado por: humano (2026-10-15), com o acréscimo de rodar também o hook Stop inteiro no teste manual.
Modelo recomendado: sonnet — tarefa mecânica, guiada por `INSTALL.md` seção 5 do kit.

## Intenção
Instalar os blocos 0.7.0 a 0.7.3 do kit (teste primeiro, aviso de teste alterado, revisor enxuto, conferência de pacote novo), preservando o que o projeto personalizou.

## Critérios de aceite
- [ ] Arquivo sem personalização é copiado do kit; arquivo personalizado recebe só a mudança do guia.
- [ ] `node --test '.claude/hooks/*.test.mjs'` passa, incluindo os testes do novo `test-warning`.
- [ ] Typecheck, testes unitários e lint passam.
- [ ] `test-warning.mjs` avisa ao apagar um `*.spec.ts` em branch descartável.

## Testes
Sem teste novo de produto: configuração do kit. Os hooks novos chegam com seus testes (`test-warning.test.mjs`).

## Risco
- **Nível:** baixo (sem código de produção).
- **Toca zona de risco?** Sim: `.claude/**` (edições pedem confirmação).
- **O que pode quebrar:** sobrescrever personalização do projeto; o `Stop` passar a bloquear por hook novo.

## Menor esforço
Menor esforço: considerei recopiar o `template/` inteiro; escolhi aplicar só o guia 0.7.0–0.7.3, arquivo a arquivo, para não perder personalização.

## Segurança
Não se aplica: sem autenticação, dados, entrada externa nem dependência.

## Tarefas (um commit cada)
1. Hooks: `test-warning.mjs` e teste (novos, constante `TEST` ajustada) e `verify-on-stop.mjs` e teste.
2. `AGENTS.md`: regra de verificação 3, frase de conferência de pacote, item do `test-warning` (só isso).
3. Agentes `implementador` e `revisor` e skills `planejar-tarefa`, `executar-tarefa`, `seguranca`.
4. `docs/PLAN_TEMPLATE.md` e `docs/PIPELINE.md`.
5. Resultado do plano e `docs/RETRO.md`.

## Arquivos a tocar
| Arquivo | Mudança |
|---|---|
| `.claude/hooks/test-warning.mjs`, `test-warning.test.mjs` | novos; `TEST` = `src/**/*.spec.ts` e `test/**/*.e2e-spec.ts` |
| `.claude/hooks/verify-on-stop.mjs`, `.test.mjs` | chama os dois avisos; filtro `ACDMR` (copiar se sem personalização, senão só o diff) |
| `AGENTS.md` | só as 3 mudanças acima |
| `.claude/agents/implementador.md`, `revisor.md` | mudanças 0.7.0, 0.7.2 e 0.7.3, preservando regras do projeto |
| `.claude/skills/planejar-tarefa`, `executar-tarefa`, `seguranca` (`SKILL.md`) | mudanças 0.7.0 e 0.7.3 |
| `docs/PLAN_TEMPLATE.md`, `docs/PIPELINE.md` | seção "Testes" e "Dependências novas"; passos do ciclo e hooks |
| `docs/plans/2026-10-15-atualizar-kit-0.7.3.md`, `docs/RETRO.md` | registro |

Não toco: `.claude/settings.json`, `.claude/verify.json`, `docs/REVIEW.md`, `block-destructive.mjs`, `doc-warning.mjs`. Não existe `VERSION` no projeto; não crio.

## Abstrações novas
- Nenhuma.

## Dependências novas
Nenhuma.

## Como verificar
```bash
node --test '.claude/hooks/*.test.mjs'
npm run typecheck && npm test -- --silent && npm run lint:check
```
+ teste manual do aviso: branch descartável, apagar um `*.spec.ts`, `node .claude/hooks/test-warning.mjs`.

## Documentação (definição de pronto)
- [ ] Sem impacto em doc: atualização de processo

## Fora de escopo
- Regras de negócio do projeto, `settings.json`, `REVIEW.md`, código de produção.

## Resultado (preencher ao concluir)
- **O que foi feito:** kit 0.6.0 → 0.7.3. Hooks `test-warning` (novos) e `verify-on-stop` copiados do kit (a diferença do projeto era só a versão antiga do kit); `AGENTS.md` com só 3 acréscimos (regra de verificação 3, frase de conferência de pacote, item do `test-warning`); agentes `implementador` e `revisor`, skills `planejar-tarefa`, `executar-tarefa` e `seguranca`, `docs/PIPELINE.md` copiados; `docs/PLAN_TEMPLATE.md` do kit com o exemplo `routine` e os comandos do projeto preservados.
- **Desvios do plano:** a constante `TEST` do `test-warning` não foi alterada: o padrão do kit já cobre `src/**/*.spec.ts` e `test/**/*.e2e-spec.ts`. `PROJECT-ADJUST.md` não foi criado.
- **Pendências:** nenhuma.
- **PR/commit:** ver o PR da branch `chore/atualizar-kit-0.7.3`.
- **Docs atualizadas:** Sem impacto em doc: atualização de processo.

### Para o manual
- **O que mudou no comportamento:** kit 0.7.3 instalado. Teste primeiro em toda tarefa que muda comportamento (teste aprovado não se altera para passar); aviso do `test-warning` no Stop quando teste é apagado, desativado ou perde verificações (`Teste alterado: <motivo>` silencia); revisor enxuto (só correção, requisito, segurança e regra de domínio; no máximo 3 sugestões); conferência de pacote novo no registro antes de pedir aprovação, com tabela no plano.
- **Decisões novas em domain/ADR:** nenhuma.
- **O que o humano precisa entender:** o aviso é só aviso: não bloqueia e não vê troca de valor esperado (`toBe(1)` virar `toBe(2)`); o revisor confere no diff. O aviso não dispara numa branch que também adiciona arquivo de teste novo (conta como substituição).
