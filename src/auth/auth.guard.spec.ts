import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import { AuthGuard } from './auth.guard';

// C9 da tarefa 9: só a verificação da assinatura vira 401; erro do banco sobe.
describe('AuthGuard (usuário ativo)', () => {
  const lookup = jest.fn();
  let guard: AuthGuard;

  const context = () =>
    ({
      switchToHttp: () => ({
        getRequest: () => ({ headers: { authorization: 'Bearer token' } }),
      }),
    }) as unknown as ExecutionContext;

  beforeEach(async () => {
    lookup.mockReset();
    const moduleRef = await Test.createTestingModule({
      providers: [
        AuthGuard,
        {
          provide: JwtService,
          useValue: {
            verifyAsync: () =>
              Promise.resolve({ sub: 'u1', email: 'a@example.com' }),
          },
        },
        {
          provide: PrismaService,
          useValue: { user: { findUnique: lookup, findFirst: lookup } },
        },
      ],
    }).compile();
    guard = moduleRef.get(AuthGuard);
  });

  it('propaga o erro do banco sem transformá-lo em 401', async () => {
    const dbError = new Error('banco fora do ar');
    lookup.mockRejectedValue(dbError);

    const result = await guard.canActivate(context()).catch((e: unknown) => e);

    expect(result).toBe(dbError);
    expect(result).not.toBeInstanceOf(UnauthorizedException);
  });

  it('usuário inexistente → 401 "Token inválido"', async () => {
    lookup.mockResolvedValue(null);

    await expect(guard.canActivate(context())).rejects.toEqual(
      new UnauthorizedException('Token inválido'),
    );
  });

  it('usuário desativado → 401 "Token inválido"', async () => {
    lookup.mockResolvedValue({ id: 'u1', deactivatedAt: new Date() });

    await expect(guard.canActivate(context())).rejects.toEqual(
      new UnauthorizedException('Token inválido'),
    );
  });

  it('usuário ativo → passa', async () => {
    lookup.mockResolvedValue({ id: 'u1', deactivatedAt: null });

    await expect(guard.canActivate(context())).resolves.toBe(true);
  });
});
