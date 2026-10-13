# Checklist de revisão do projeto

Lido pelo subagente `revisor` (`.claude/agents/revisor.md`), que já cobre complexidade desnecessária, documentação e verificações. Aqui ficam as regras de negócio e de segurança **deste** projeto (NestJS + Prisma + PostgreSQL).

## Regras de negócio
- [ ] Respeita as regras e invariantes de `docs/domain.md`?
- [ ] Toda query de recurso do usuário filtra por `userId` vindo do token, nunca do body?
- [ ] Escrita em múltiplas tabelas está em `$transaction`?
- [ ] Erros retornam o status certo (404 para recurso alheio ou inexistente, 409 para conflito, 400 para validação)?

## Segurança
- [ ] Rota nova protegida com `AuthGuard` quando deveria?
- [ ] DTO com class-validator e limites (`MaxLength`, `IsInt`, `IsUUID`) coerentes com o `VarChar` do schema?
- [ ] Senha, hash ou token vazando em resposta ou log?
- [ ] SQL cru (`$queryRaw`/`$executeRaw`) com interpolação insegura?
- [ ] Mudança em `prisma/migrations/`, `prisma/schema.prisma`, `src/auth/` ou `.github/workflows/`? Migration existente editada?
