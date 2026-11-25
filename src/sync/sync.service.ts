import { HttpException, Injectable } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { isUUID, validate } from 'class-validator';
import { PrismaService } from '../prisma/prisma.service';
import { SessionsService } from '../sessions/sessions.service';
import { SyncDto, SyncSessionDto, SyncSetDto } from './dto/sync.dto';

type ItemError = { statusCode: number; message: string | string[] };
type ItemResult = {
  id: string | null;
  status: 'created' | 'existing' | 'closed' | 'error';
  error?: ItemError;
};
// Item validado: posição na lista enviada e o DTO (id em minúsculas).
type Valid<T> = { index: number; dto: T };

type Prepared<T> = {
  results: ItemResult[];
  valid: Valid<T>[];
  finish: () => void;
};

const fail = (
  id: string | null,
  statusCode: number,
  message: ItemError['message'],
): ItemResult => ({
  id,
  status: 'error',
  error: { statusCode, message },
});

@Injectable()
export class SyncService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly sessions: SessionsService,
  ) {}

  async sync(userId: string, body: SyncDto) {
    const sessionItems = await this.prepare(
      body.sessions ?? [],
      SyncSessionDto,
    );
    const setItems = await this.prepare(body.sets ?? [], SyncSetDto);

    const autoClosedSessionIds = await this.syncSessions(userId, sessionItems);
    await this.syncSets(userId, setItems);

    return {
      sessions: sessionItems.results,
      sets: setItems.results,
      mealLogs: [],
      autoClosedSessionIds,
    };
  }

  // Valida o formato de cada item e descarta as repetições (id em minúsculas):
  // a repetição fica sem processar e recebe o resultado da primeira em `finish`.
  private async prepare<T extends { id: string }>(
    raw: unknown[],
    cls: new () => T,
  ): Promise<Prepared<T>> {
    const results: ItemResult[] = new Array<ItemResult>(raw.length);
    const valid: Valid<T>[] = [];
    const repeats: { index: number; first: number }[] = [];
    const firstOf = new Map<string, number>();
    for (const [index, item] of raw.entries()) {
      if (typeof item !== 'object' || item === null || Array.isArray(item)) {
        results[index] = fail(null, 400, ['item deve ser um objeto']);
        continue;
      }
      const rawId = (item as { id?: unknown }).id;
      const id =
        typeof rawId === 'string' && isUUID(rawId) ? rawId.toLowerCase() : null;
      if (id !== null && firstOf.has(id)) {
        repeats.push({ index, first: firstOf.get(id)! });
        continue;
      }
      if (id !== null) firstOf.set(id, index);
      const dto = plainToInstance(cls, item);
      const errors = await validate(dto, {
        whitelist: true,
        forbidNonWhitelisted: true,
      });
      if (errors.length > 0) {
        results[index] = fail(
          id,
          400,
          errors.flatMap((e) => Object.values(e.constraints ?? {})),
        );
        continue;
      }
      valid.push({ index, dto: { ...dto, id: dto.id.toLowerCase() } });
    }
    return {
      results,
      valid,
      // Chamado depois do processamento: a repetição vira existing, ou copia o erro da primeira.
      finish() {
        for (const { index, first } of repeats) {
          const r = results[first];
          results[index] =
            r.status === 'error' ? { ...r } : { id: r.id, status: 'existing' };
        }
      },
    };
  }

  // Fase de sessões: transação com a linha do usuário travada; todas as checagens antes de qualquer escrita.
  private async syncSessions(userId: string, items: Prepared<SyncSessionDto>) {
    const { results, valid } = items;
    const autoClosed: string[] = [];
    if (valid.length > 0) {
      await this.prisma.$transaction(async (tx) => {
        await tx.$queryRaw`SELECT 1 FROM users WHERE id = ${userId} FOR NO KEY UPDATE`;
        const found = new Map(
          (
            await tx.workoutSession.findMany({
              where: { id: { in: valid.map((v) => v.dto.id) } },
            })
          ).map((s) => [s.id, s]),
        );
        const workouts = new Set(
          (
            await tx.workout.findMany({
              where: { userId, id: { in: valid.map((v) => v.dto.workoutId) } },
              select: { id: true },
            })
          ).map((w) => w.id),
        );

        const toClose: { id: string; finishedAt: Date }[] = [];
        const candidates: {
          dto: SyncSessionDto;
          startedAt: Date;
          finishedAt: Date | null;
        }[] = [];
        for (const { index, dto } of valid) {
          const row = found.get(dto.id);
          const finishedAt = dto.finishedAt ? new Date(dto.finishedAt) : null;
          if (row && row.userId !== userId) {
            results[index] = fail(dto.id, 409, 'Id de sessão já utilizado');
          } else if (row) {
            if (row.finishedAt === null && finishedAt) {
              toClose.push({ id: row.id, finishedAt });
              row.finishedAt = finishedAt; // sai da disputa
              results[index] = { id: dto.id, status: 'closed' };
            } else {
              results[index] = { id: dto.id, status: 'existing' };
            }
          } else if (!workouts.has(dto.workoutId)) {
            results[index] = fail(dto.id, 404, 'Treino não encontrado');
          } else {
            candidates.push({
              dto,
              startedAt: new Date(dto.startedAt),
              finishedAt,
            });
            results[index] = { id: dto.id, status: 'created' };
          }
        }

        // Disputa de S3: abertas do servidor + candidatas sem finishedAt; vence (startedAt, id) maior.
        const serverOpen = await tx.workoutSession.findMany({
          where: { userId, finishedAt: null },
        });
        const pool = [
          ...serverOpen.map((s) => ({
            id: s.id,
            startedAt: s.startedAt,
            server: true,
          })),
          ...candidates
            .filter((c) => !c.finishedAt)
            .map((c) => ({
              id: c.dto.id,
              startedAt: c.startedAt,
              server: false,
            })),
        ].sort(
          (a, b) =>
            b.startedAt.getTime() - a.startedAt.getTime() ||
            (a.id < b.id ? 1 : -1),
        );
        const losers = pool.slice(1);
        const winnerId = pool[0]?.id;

        // Ordem de escrita (nunca viola o índice): encerra, perdedoras do servidor, candidatas, vencedora.
        for (const c of toClose) {
          await tx.workoutSession.update({
            where: { id: c.id },
            data: { finishedAt: c.finishedAt },
          });
        }
        for (const l of losers.filter((x) => x.server)) {
          await tx.workoutSession.update({
            where: { id: l.id },
            data: { finishedAt: l.startedAt },
          });
          autoClosed.push(l.id);
        }
        const loserIds = new Set(losers.map((l) => l.id));
        const ordered = [
          ...candidates.filter((c) => loserIds.has(c.dto.id)),
          ...candidates.filter((c) => c.finishedAt),
          ...candidates.filter((c) => c.dto.id === winnerId),
        ];
        for (const c of ordered) {
          const lost = loserIds.has(c.dto.id);
          await tx.workoutSession.create({
            data: {
              id: c.dto.id,
              userId,
              workoutId: c.dto.workoutId,
              startedAt: c.startedAt,
              finishedAt: lost ? c.startedAt : c.finishedAt,
            },
          });
          if (lost) autoClosed.push(c.dto.id);
        }
      });
    }
    items.finish();
    return autoClosed;
  }

  // Séries depois, item a item, pela lógica da rota individual; erro conhecido vira item error.
  private async syncSets(userId: string, items: Prepared<SyncSetDto>) {
    for (const { index, dto } of items.valid) {
      const { sessionId, ...set } = dto;
      try {
        const { created } = await this.sessions.createSet(
          userId,
          sessionId,
          set,
        );
        items.results[index] = {
          id: dto.id,
          status: created ? 'created' : 'existing',
        };
      } catch (e) {
        if (
          e instanceof HttpException &&
          [400, 404, 409, 410].includes(e.getStatus())
        ) {
          const { message } = e.getResponse() as {
            message: ItemError['message'];
          };
          items.results[index] = fail(dto.id, e.getStatus(), message);
        } else {
          throw e;
        }
      }
    }
    items.finish();
  }
}
