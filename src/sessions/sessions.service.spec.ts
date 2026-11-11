import { ConflictException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { SessionsService } from './sessions.service';

describe('SessionsService', () => {
  let service: SessionsService;
  const prisma = {
    workout: { findFirst: jest.fn() },
    workoutItem: { count: jest.fn() },
    workoutSession: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
    },
  };

  const dto = {
    id: '11111111-1111-4111-8111-111111111111',
    workoutId: '22222222-2222-4222-8222-222222222222',
    startedAt: '2026-11-09T10:00:00.000Z',
  };
  const stored = (userId: string) => ({
    id: dto.id,
    userId,
    workoutId: dto.workoutId,
    startedAt: new Date(dto.startedAt),
    finishedAt: null,
  });
  const p2002 = () =>
    new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
      code: 'P2002',
      clientVersion: 'test',
    });

  beforeEach(async () => {
    jest.resetAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SessionsService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<SessionsService>(SessionsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('P2002 na criação', () => {
    beforeEach(() => {
      prisma.workout.findFirst.mockResolvedValue({
        id: dto.workoutId,
        userId: 'user-a',
      });
      prisma.workoutItem.count.mockResolvedValue(1);
      prisma.workoutSession.findFirst.mockResolvedValue(null);
      prisma.workoutSession.create.mockRejectedValue(p2002());
    });

    it('relê pelo id e devolve a sessão do mesmo usuário como não criada (200)', async () => {
      prisma.workoutSession.findUnique
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(stored('user-a'));

      await expect(service.create('user-a', dto)).resolves.toEqual({
        created: false,
        session: stored('user-a'),
      });
    });

    it('lança 409 se a sessão gravada na corrida for de outro usuário', async () => {
      prisma.workoutSession.findUnique
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(stored('user-b'));

      await expect(service.create('user-a', dto)).rejects.toBeInstanceOf(
        ConflictException,
      );
    });
  });
});
