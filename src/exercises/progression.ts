import { Prisma } from '@prisma/client';

// Tetos e passos em centésimos de kg (Decimal(6,2)): a conta é toda em inteiros.
const MAX_CENT = 999999;

export interface ProgressionSet {
  weightKg: Prisma.Decimal | null;
  repsCompleted: number | null;
  failed: boolean;
}

export interface ProgressionItem {
  progressionType: 'NONE' | 'DOUBLE' | 'LINEAR';
  progressionStepPercent: Prisma.Decimal | null;
  targetRepsMin: number | null;
  targetRepsMax: number | null;
  targetSets: number;
}

const toWeight = (cent: number) => new Prisma.Decimal(cent).div(100).toString();

export function suggestLoad(
  sets: ProgressionSet[],
  item: ProgressionItem,
): { weightKg: string; increase: boolean } | null {
  if (
    item.progressionType === 'NONE' ||
    item.progressionStepPercent === null ||
    item.targetRepsMin === null ||
    item.targetRepsMax === null
  ) {
    return null;
  }

  const loaded = sets
    .filter((s) => s.weightKg !== null)
    .map((s) => ({ ...s, cent: s.weightKg!.mul(100).toNumber() }));
  if (loaded.length === 0) return null;

  const base = Math.max(...loaded.map((s) => s.cent));
  if (base === 0) return null;

  const counting = loaded.filter((s) => s.cent === base);
  const goal =
    item.progressionType === 'DOUBLE' ? item.targetRepsMax : item.targetRepsMin;
  const ready =
    counting.length >= item.targetSets &&
    counting.every(
      (s) => !s.failed && s.repsCompleted !== null && s.repsCompleted >= goal,
    );
  if (!ready) return { weightKg: toWeight(base), increase: false };

  const stepTenths = item.progressionStepPercent.mul(10).toNumber();
  let next = Math.floor((base * (1000 + stepTenths)) / 50000) * 50;
  if (next <= base) next = (Math.floor(base / 50) + 1) * 50;
  next = Math.min(next, MAX_CENT);

  return { weightKg: toWeight(next), increase: next > base };
}
