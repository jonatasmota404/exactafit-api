# Plano: atualizar o kit de IA de 0.7.3 para 0.7.4

Aprovado por: humano (2026-10-15).
Modelo recomendado: sonnet — cópia guiada pelo bloco 0.7.4 do `INSTALL.md` do kit.

## Intenção
Instalar a correção do hook `test-warning`: o aviso de teste apagado passa a disparar mesmo quando a branch cria outro teste novo.

## Critérios de aceite
- [ ] `test-warning.mjs` e `test-warning.test.mjs` iguais ao kit 0.7.4, preservando a constante `TEST` do projeto, se personalizada.
- [ ] `node --test '.claude/hooks/*.test.mjs'` passa.
- [ ] Branch da `main` que apaga um `*.spec.ts` e cria outro com conteúdo diferente: o Stop mostra "Aviso de testes: arquivo de teste apagado".

## Testes
Sem teste novo: o teste vem junto com o hook copiado do kit.

## Risco
- **Nível:** baixo (sem código de produção).
- **Toca zona de risco?** Sim: `.claude/` (edições pedem confirmação).
- **O que pode quebrar:** o aviso aparecer em mais casos (só informa, nunca bloqueia).

## Menor esforço
Menor esforço: considerei reaplicar o kit inteiro; escolhi copiar só os dois arquivos do bloco 0.7.4.

## Segurança
Não se aplica: sem autenticação, dados, entrada externa nem dependência.

## Tarefas (um commit cada)
1. Copiar `test-warning.mjs` e `test-warning.test.mjs` do kit (conferindo `diff` e a `TEST`).
2. Resultado do plano.

## Arquivos a tocar
| Arquivo | Mudança |
|---|---|
| `.claude/hooks/test-warning.mjs` | copiado do kit 0.7.4 (preservando `TEST` do projeto) |
| `.claude/hooks/test-warning.test.mjs` | copiado do kit 0.7.4 |
| `docs/plans/2026-10-15-atualizar-kit-0.7.4.md` | este plano |

## Abstrações novas
- Nenhuma.

## Dependências novas
Nenhuma.

## Como verificar
```bash
node --test '.claude/hooks/*.test.mjs'
```
+ teste do bug: branch descartável da `main`, apagar um `*.spec.ts`, criar outro com conteúdo diferente, `echo '{}' | node <cópia dos hooks fora do repo>/verify-on-stop.mjs`.

## Documentação (definição de pronto)
- [ ] Sem impacto em doc: atualização de processo

## Fora de escopo
- Qualquer outro arquivo do kit, `settings.json`, código de produção.

## Resultado (preencher ao concluir)
- **O que foi feito:** `test-warning.mjs` e `test-warning.test.mjs` copiados do kit 0.7.4. O `diff` mostrou só a correção; a constante `TEST` já era a do kit.
- **Desvios do plano:** nenhum.
- **Pendências:** nenhuma.
- **PR/commit:** ver o PR da branch `chore/atualizar-kit-0.7.4`.
- **Docs atualizadas:** Sem impacto em doc: atualização de processo.

### Para o manual
- **O que mudou no comportamento:** kit 0.7.4 instalado. O aviso de teste apagado agora dispara mesmo quando a branch cria outro teste novo; só renomeação que o git reconhece fica sem aviso.
- **Decisões novas em domain/ADR:** nenhuma.
- **O que o humano precisa entender:** mover teste com grande mudança de conteúdo conta como apagado; declare `Teste alterado: <motivo>` no commit ou no plano. O aviso continua só avisando, sem bloquear.
