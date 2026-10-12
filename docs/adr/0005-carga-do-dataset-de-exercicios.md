# ADR 0005 — Carga do dataset de exercícios

- **Status:** aceito (implementação ainda não planejada)
- **Data:** 2026-10-12
- **Autor:** Jônatas Júnior

## Contexto
O catálogo oficial vem de um dataset local, fora deste repositório (`/home/jonatas/Projetos/exercices-dataset/exercises-dataset/`): 1324 exercícios em `data/exercises.json`, cada um com `id` de 4 dígitos único, 10 valores de `body_part`, instruções em 10 idiomas (sem português) e mídia (jpg e gif, 180×180, 299 MB no total). Os dados são MIT. A mídia é © Gym visual, fora da MIT, com atribuição obrigatória e termos próprios; o `LICENSE` do dataset diz que clonar o repositório não concede licença da mídia. O app será vendido no futuro.

## Decisão
- O dataset local é a **fonte única da verdade** por enquanto.
- A carga é **repetível**: cada exercício oficial guarda o id que tinha no dataset; o script insere o novo e atualiza o existente, sem duplicar.
- A API guarda só a **referência** da mídia e a entrega apenas a usuário autenticado, sempre com a atribuição "© Gym visual — https://gymvisual.com/". Não expõe publicamente e não há chave que a desligue.
- `Exercise.muscleGroup` recebe o `body_part` do dataset (10 valores).
- Trocar de dataset ou de licença da mídia para uso comercial fica **adiado**, sem desenho agora.

## Alternativas descartadas
- **Carga única:** atualizar o dataset depois duplicaria exercícios, porque o nome pode repetir (E5).
- **Sem referência de mídia no V1:** descartado pelo humano.
- **Mídia atrás de uma chave de configuração:** descartado pelo humano; a entrega a todos os autenticados vale desde já.

## Consequências
- **Positivas:** o catálogo pode ser corrigido sem tocar em fichas e séries que já o referenciam.
- **Negativas / custos:** coluna do id do dataset em `Exercise` (junto da migration de dono de E1); script de carga; um lugar fora da API pública para guardar 299 MB de mídia. **A conferência dos termos da Gym visual antes de convidar outros usuários é do humano e não foi verificada.** Trocar a fonte de mídia para o uso comercial é trabalho futuro não desenhado.
- **O que passa a ser obrigatório:** toda entrega de mídia leva a atribuição. A API não serve mídia sem autenticação.
- **Em aberto (`TODO(humano)`):** onde os arquivos de mídia ficam guardados; idioma das instruções (o dataset não tem português); existência e custo da "API oficial" mencionada pelo humano (não verificado).
- Regras: `docs/domain.md` E1, E4, E5 e bloco (b).
