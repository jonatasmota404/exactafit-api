# ADR 0005 — Carga do dataset de exercícios

- **Status:** aceito (implementação ainda não planejada)
- **Data:** 2026-10-12
- **Autor:** Jônatas Júnior

## Contexto
O catálogo oficial vem de um dataset local, fora deste repositório (`/home/jonatas/Projetos/exercices-dataset/exercises-dataset/`): 1324 exercícios em `data/exercises.json`, cada um com `id` de 4 dígitos único, 10 valores de `body_part`, instruções em 10 idiomas (sem português) e mídia (jpg e gif, 180×180, 299 MB no total). Os dados são MIT. A mídia é © Gym visual, fora da MIT, com atribuição obrigatória e termos próprios; o `LICENSE` do dataset diz que clonar o repositório não concede licença da mídia. O app será vendido no futuro; por enquanto não é comercial.

## Decisão
- O dataset local é a **fonte única da verdade** por enquanto.
- A carga é **repetível**: cada exercício oficial guarda o id que tinha no dataset; o script insere o novo e atualiza o existente, sem duplicar.
- A API guarda só a **referência** da mídia e a entrega apenas a usuário autenticado, sempre com a atribuição "© Gym visual — https://gymvisual.com/". Não expõe publicamente e não há chave que a desligue.
- `Exercise.muscleGroup` recebe o `body_part` do dataset (10 valores).
- Trocar de dataset ou de licença da mídia para uso comercial fica **adiado**, sem desenho agora.
- **Licença:** a mídia e a "API oficial" estão liberadas para uso **enquanto o app não for comercial** (decisão do humano). Reconferir a licença antes de qualquer uso comercial é `TODO(humano)`.
- **Mídia (~299 MB):** volume na VPS servido pelo proxy do Coolify, fora do git e fora do banco; o banco guarda só o caminho. `DECIDIDO (por delegação)`, confirmado pelo humano.
- **Idioma das instruções:** inglês e português, com português como padrão. O dataset não tem português (traz inglês e outros 9 idiomas), então a tradução precisa ser produzida.

## Alternativas descartadas
- **Carga única:** atualizar o dataset depois duplicaria exercícios, porque o nome pode repetir (E5).
- **Sem referência de mídia no V1:** descartado pelo humano.
- **Mídia atrás de uma chave de configuração:** descartado pelo humano; a entrega a todos os autenticados vale desde já.

## Consequências
- **Positivas:** o catálogo pode ser corrigido sem tocar em fichas e séries que já o referenciam.
- **Negativas / custos:** coluna do id do dataset em `Exercise` (junto da migration de dono de E1); script de carga; um lugar fora da API pública para guardar 299 MB de mídia. Trocar a fonte de mídia para o uso comercial é trabalho futuro não desenhado. Suporte a dois idiomas muda o modelo de `Exercise` (ou cria estrutura de instruções por idioma, a definir no plano) e multiplica o conteúdo a carregar; a tradução é conteúdo novo, sem revisor definido.
- **O que passa a ser obrigatório:** toda entrega de mídia leva a atribuição. A mídia não é pública; só usuário autenticado a recebe.
- **Em aberto (`TODO(humano)`):** como a exigência "só usuário autenticado" é aplicada quando o proxy serve o arquivo direto; como produzir a tradução para português e quem revisa; tradução do nome dos exercícios e dos 10 valores de `muscleGroup`; reconferir a licença da mídia e da "API oficial" antes de uso comercial.
- Regras: `docs/domain.md` E1, E4, E5 e bloco (b).
