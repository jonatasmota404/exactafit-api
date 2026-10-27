# Receitas de verificação

Duas receitas para conferir se as barreiras funcionam, em vez de confiar nelas. Nenhuma é obrigatória.

## 1. Testar o revisor com defeitos plantados

**Para quê:** saber o que o agente `revisor` pega e o que deixa passar. Rode ao instalar o kit, depois de mudar `docs/REVIEW.md` ou o `revisor`, e de tempos em tempos.

1. Crie uma branch descartável a partir da `main` atualizada:
   ```bash
   git switch main && git pull --ff-only && git switch -c treino/revisor-AAAA-MM-DD
   ```
2. Escreva um plano curto em `docs/plans/treino-revisor.md` com 2 ou 3 critérios de aceite.
3. Plante de 3 a 5 defeitos conhecidos, cada um de um tipo do checklist. Exemplos:
   - um critério do plano sem código (deve sair como **faltando**);
   - um helper ou interface novo com um só uso;
   - uma verificação apagada de um teste existente;
   - um arquivo alterado que o plano não lista;
   - uma regra de `docs/domain.md` contrariada.

   Use só defeitos que passam no typecheck, nos testes e no lint: o que a ferramenta pega não testa o revisor.
4. Anote a lista de defeitos **fora do repositório** (num papel ou no manual). O revisor não pode vê-la.
5. Faça o commit na branch de treino. Nunca faça push nem abra PR dela.
6. Em sessão nova: `use o agente revisor no diff desta branch contra a main, com o plano docs/plans/treino-revisor.md`.
7. Compare o relatório com a sua lista:
   - placar "achou X de N";
   - a severidade de cada achado está certa?
   - houve falso positivo?
8. Defeito que passou vira item novo em `docs/REVIEW.md`, num PR normal. Depois do merge, repita o treino com um defeito do mesmo tipo.
9. Descarte: `git switch main`. Apagar a branch fica com você (`git branch -D treino/revisor-AAAA-MM-DD`), porque o hook bloqueia essa remoção pelo agente.
10. Registre uma linha em `docs/RETRO.md`: data, placar e o que mudou no checklist.

## 2. Antes e depois (risco alto, opcional)

**Para quê:** provar que a mudança alterou só o alvo. A mesma captura roda antes e depois da mudança, e a diferença entre as duas deve conter só o que o plano pede.

1. **No plano**, em "Como verificar", declare o comando de captura e o que deve mudar. Duas opções:
   - a suíte de testes com uma linha por teste (nome e resultado);
   - um snapshot de saída: um script que chama as funções ou rotas afetadas com entradas fixas e imprime o resultado em ordem estável.
2. **Antes:** rode a captura na branch recém-criada, antes de qualquer mudança, e guarde fora do repositório:
   ```bash
   <comando de captura> > /tmp/<tarefa>-antes.txt
   ```
   Se a branch já tem mudanças, capture a `main` num diretório à parte: `git worktree add ../<projeto>-main main`. Rode a captura lá e, ao terminar, `git worktree remove ../<projeto>-main`.
3. **Depois:** rode a mesma captura na branch com a mudança pronta, em `/tmp/<tarefa>-depois.txt`.
4. **Compare:** `diff /tmp/<tarefa>-antes.txt /tmp/<tarefa>-depois.txt`.
   - Só as linhas do alvo mudaram: cole o diff no "Resultado" do plano e na descrição do PR.
   - Mudou algo fora do alvo: pare. É regressão até prova em contrário.
5. **Saída instável** (hora, id aleatório, ordem variável): normalize antes de comparar, por exemplo ordenando ou trocando o valor por um marcador. Se não der, escreva "antes/depois: não comparável" e o motivo. Não force.

A captura não usa dado real de cliente nem segredo, e o arquivo de saída não entra no commit.
