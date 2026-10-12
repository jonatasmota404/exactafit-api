# ADR 0008 — Mínimo de senha só no cadastro

- **Status:** aceito (implementação ainda não planejada)
- **Data:** 2026-10-12
- **Autor:** Jônatas Júnior

## Contexto
Hoje cadastro e login exigem senha de 6 a 72 caracteres (`register.dto.ts`, `login.dto.ts`). A decisão de subir o mínimo para 8 estava registrada para os dois DTOs (`docs/domain.md` U3, na branch `docs/dominio-3`). No login, isso deixaria sem acesso as contas de 6–7 caracteres, e não há troca de senha.

## Decisão
- **Cadastro:** senha com mínimo de 8 e máximo de 72 caracteres.
- **Login:** a senha só precisa ser não vazia, com máximo de 72. O mínimo de 8 não vale no login.
- **Revisão em 2026-10-12.** Antes: login também com mínimo de 8. Depois: mínimo de 8 só no cadastro.

## Alternativas descartadas
- **Mínimo de 8 também no login:** contas com senha de 6–7 caracteres ficam sem acesso e sem como voltar.

## Consequências
- **Positivas:** nenhuma conta existente perde o acesso.
- **Negativas / custos:** o login aceita entrada curta; só contas criadas antes da mudança podem ter senha de 6–7 caracteres. O bcrypt conta bytes e ignora o excedente em silêncio (risco aceito, já registrado em U3).
- **O que passa a ser obrigatório:** o mínimo de 8 fica só em `register.dto.ts`; `login.dto.ts` não pode exigir mínimo.
- **Em aberto (`TODO(humano)`):** nenhum.
- Regra: `docs/domain.md` U3.
