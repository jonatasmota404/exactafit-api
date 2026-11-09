# Peças opcionais

Ficam fora do fluxo padrão porque só dão visibilidade ao humano ou porque custam caro para todo PR. Ligue uma quando aparecer o motivo da coluna "Quando usar". Os arquivos estão no kit, na pasta `opcional/`, com o mesmo caminho que terão no projeto.

| Peça | O que faz | Quando usar | Como ligar |
|---|---|---|---|
| RETRO (`docs/RETRO.md`) | Uma linha por erro repetido ou surpresa; na terceira vez, o erro vira hook, teste ou regra | O mesmo erro do agente aparece em tarefas diferentes | Copie `opcional/docs/RETRO.md` |
| Aviso de documentação (`.claude/hooks/doc-warning.mjs`) | No Stop, avisa código de módulo alterado sem doc (nem `Sem impacto em doc: <motivo>` no commit), link quebrado em `docs/` e número de ADR duplicado. Só avisa | Equipe que mantém `docs/` grande e quer lembrete | Copie o hook e o teste de `opcional/.claude/hooks/`; ajuste a regex `CODE` (`PROJECT-ADJUST.md`). O `verify-on-stop` o chama quando o arquivo existe |
| Receitas de verificação (`docs/RECEITAS.md`) | (1) Testar o revisor com defeitos plantados; (2) antes/depois numa mudança de risco alto | Ao instalar o kit, ao mudar o `revisor` ou o `docs/REVIEW.md`; risco alto com saída comparável | Copie `opcional/docs/RECEITAS.md` |
| Mutation testing no diff | Altera o código do diff (troca operador, condição, retorno) e confere se algum teste falha. Mutante que sobrevive é teste faltando | Módulo de risco alto, ou suspeita de que os testes passam sem provar nada | Rode a ferramenta da linguagem só nos arquivos do diff (exemplos em `PROJECT-ADJUST.md`). Mutantes sobreviventes viram critérios ou testes; não precisa de 100% |
| Gate de tamanho do diff no CI | Falha o PR com mais de ~300 linhas de produção (regra 6 do `AGENTS.md`) | A regra em prosa passou a ser ignorada | Passo de CI abaixo |
| Testes de contrato no CI | Confere que a API ainda cumpre o contrato publicado (esquema, status, campos) | API consumida por outro sistema ou outro repositório | Gere ou valide o contrato no CI; quebra de contrato falha o PR e vira risco alto |
| Testes de integração no CI | Roda a integração (banco, filas, serviços) em todo PR | Integração lenta demais para o Stop, ou ambiente que só existe no CI | Job de CI com o comando de integração da tabela "Comandos" e os serviços que ele exige |

## Gate de tamanho do diff
Conta só código de produção: ignora `docs/`, Markdown e arquivos com `test` ou `spec` no nome. Ajuste as exclusões ao projeto.

```yaml
      - uses: actions/checkout@v7
        with:
          fetch-depth: 0
      - name: Tamanho do diff de produção
        run: |
          n=$(git diff --numstat origin/${{ github.base_ref }}...HEAD -- . ':(exclude)docs/**' \
            ':(exclude,glob)**/*test*' ':(exclude,glob)**/*spec*' ':(exclude,glob)**/*.md' \
            | awk '$1 != "-" {s += $1 + $2} END {print s + 0}')
          echo "linhas de produção alteradas: $n"
          [ "$n" -le 300 ] || { echo "::error::diff de produção com $n linhas (> 300): divida a tarefa"; exit 1; }
```
