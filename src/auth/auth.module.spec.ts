import { Test } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { AuthModule } from './auth.module';
import { PrismaModule } from '../prisma/prisma.module';
import { PrismaService } from '../prisma/prisma.service';

describe('AuthModule (JWT_SECRET)', () => {
  const original = process.env.JWT_SECRET;

  afterEach(() => {
    if (original === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = original;
  });

  const compile = () =>
    Test.createTestingModule({ imports: [PrismaModule, AuthModule] })
      .overrideProvider(PrismaService)
      .useValue({})
      .compile();

  it('não sobe sem JWT_SECRET', async () => {
    delete process.env.JWT_SECRET;

    await expect(compile()).rejects.toThrow(/JWT_SECRET/);
  });

  it('não sobe com JWT_SECRET de menos de 32 caracteres, sem expor o valor', async () => {
    const curto = 'segredo-curto-de-teste-31-chars';
    expect(curto).toHaveLength(31);
    process.env.JWT_SECRET = curto;

    const erro = (await compile().catch((e: unknown) => e)) as Error;

    expect(erro).toBeInstanceOf(Error);
    expect(erro.message).toMatch(/JWT_SECRET/);
    expect(erro.message).not.toContain(curto);
  });

  it('sobe com JWT_SECRET de 32+ caracteres e assina/verifica tokens', async () => {
    process.env.JWT_SECRET = 'segredo-de-teste-unitario-com-32+';

    const moduleRef = await compile();
    const jwt = moduleRef.get(JwtService);
    const token = await jwt.signAsync({ sub: 'u1', email: 'a@b.c' });

    await expect(jwt.verifyAsync(token)).resolves.toMatchObject({
      sub: 'u1',
    });
  });
});
