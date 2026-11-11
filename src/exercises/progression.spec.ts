// Tarefa 8 (C8): regras da sugestão de carga, como função pura.
import { Prisma } from '@prisma/client';
import { suggestLoad, ProgressionItem, ProgressionSet } from './progression';

const d = (v: string) => new Prisma.Decimal(v);
const set = (
  weightKg: string | null,
  repsCompleted: number | null,
  failed = false,
): ProgressionSet => ({
  weightKg: weightKg === null ? null : d(weightKg),
  repsCompleted,
  failed,
});

const double = (extra: Partial<ProgressionItem> = {}): ProgressionItem => ({
  progressionType: 'DOUBLE',
  progressionStepPercent: d('2.5'),
  targetRepsMin: 8,
  targetRepsMax: 12,
  targetSets: 3,
  ...extra,
});
const linear = (extra: Partial<ProgressionItem> = {}) =>
  double({ progressionType: 'LINEAR', ...extra });

const three = (w: string, reps: number) => [
  set(w, reps),
  set(w, reps),
  set(w, reps),
];

describe('suggestLoad (C8)', () => {
  describe('dupla', () => {
    it('sobe com targetSets séries na maior carga, todas no máximo e sem falha', () => {
      expect(suggestLoad(three('60', 12), double())).toEqual({
        weightKg: '61.5',
        increase: true,
      });
    });

    it('repete se uma série tem falha', () => {
      expect(
        suggestLoad(
          [set('60', 12), set('60', 12), set('60', 12, true)],
          double(),
        ),
      ).toEqual({ weightKg: '60', increase: false });
    });

    it('repete se uma série não chegou ao máximo', () => {
      expect(
        suggestLoad([set('60', 12), set('60', 11), set('60', 12)], double()),
      ).toEqual({ weightKg: '60', increase: false });
    });

    it('repete se fez menos séries que targetSets', () => {
      expect(suggestLoad([set('60', 12), set('60', 12)], double())).toEqual({
        weightKg: '60',
        increase: false,
      });
    });

    it('repete se repsCompleted é nulo (P4)', () => {
      expect(
        suggestLoad([set('60', 12), set('60', null), set('60', 12)], double()),
      ).toEqual({ weightKg: '60', increase: false });
    });
  });

  describe('linear', () => {
    it('sobe com todas no mínimo da faixa e sem falha', () => {
      expect(suggestLoad(three('60', 8), linear())).toEqual({
        weightKg: '61.5',
        increase: true,
      });
    });

    it('repete com uma abaixo do mínimo', () => {
      expect(
        suggestLoad([set('60', 8), set('60', 7), set('60', 8)], linear()),
      ).toEqual({ weightKg: '60', increase: false });
    });

    it('exige targetSets séries (P3)', () => {
      expect(suggestLoad([set('60', 8), set('60', 8)], linear())).toEqual({
        weightKg: '60',
        increase: false,
      });
    });
  });

  describe('base e séries que contam', () => {
    it('ignora as séries mais leves', () => {
      expect(
        suggestLoad([set('40', 15), ...three('60', 12)], double()),
      ).toEqual({ weightKg: '61.5', increase: true });
    });

    it('série mais leve com falha não impede a subida (P7)', () => {
      expect(
        suggestLoad([set('40', 5, true), ...three('60', 12)], double()),
      ).toEqual({ weightKg: '61.5', increase: true });
    });

    it('séries sem carga não contam nem impedem a subida (P7)', () => {
      expect(
        suggestLoad([set(null, 3), ...three('60', 12), set(null, 1)], double()),
      ).toEqual({ weightKg: '61.5', increase: true });
    });
  });

  describe('arredondamento', () => {
    it('60 + 2,5% = 61,5', () => {
      expect(suggestLoad(three('60', 12), double())?.weightKg).toBe('61.5');
    });

    it('61,25 + 2,5% = 62,78 → 62,5', () => {
      expect(suggestLoad(three('61.25', 12), double())?.weightKg).toBe('62.5');
    });

    it('10 + 1% = 10,1 → próximo múltiplo acima, 10,5', () => {
      expect(
        suggestLoad(
          three('10', 12),
          double({ progressionStepPercent: d('1') }),
        ),
      ).toEqual({ weightKg: '10.5', increase: true });
    });

    it('10,3 + 1% = 10,4 → próximo múltiplo acima, 10,5', () => {
      expect(
        suggestLoad(
          three('10.3', 12),
          double({ progressionStepPercent: d('1') }),
        ),
      ).toEqual({ weightKg: '10.5', increase: true });
    });

    it('60,29 + 1% = 60,89 → 60,5 (Decimal sem float)', () => {
      expect(
        suggestLoad(
          three('60.29', 12),
          double({ progressionStepPercent: d('1') }),
        ),
      ).toEqual({ weightKg: '60.5', increase: true });
    });

    it('0,29 + 10% = 0,319 → próximo múltiplo acima, 0,5', () => {
      expect(
        suggestLoad(
          three('0.29', 12),
          double({ progressionStepPercent: d('10') }),
        ),
      ).toEqual({ weightKg: '0.5', increase: true });
    });

    it('9999,99 + 10% fica no teto, sem subir', () => {
      expect(
        suggestLoad(
          three('9999.99', 12),
          double({ progressionStepPercent: d('10') }),
        ),
      ).toEqual({ weightKg: '9999.99', increase: false });
    });

    it('9990 + 10% para no teto 9999,99 e sobe', () => {
      expect(
        suggestLoad(
          three('9990', 12),
          double({ progressionStepPercent: d('10') }),
        ),
      ).toEqual({ weightKg: '9999.99', increase: true });
    });
  });

  describe('sem sugestão (null)', () => {
    it('regra NONE', () => {
      expect(
        suggestLoad(
          three('60', 12),
          double({ progressionType: 'NONE', progressionStepPercent: null }),
        ),
      ).toBeNull();
    });

    it('nenhuma série com carga', () => {
      expect(
        suggestLoad([set(null, 12), set(null, 12), set(null, 12)], double()),
      ).toBeNull();
    });

    it('maior carga igual a 0', () => {
      expect(suggestLoad(three('0', 12), double())).toBeNull();
    });

    it('item sem faixa de repetições', () => {
      expect(
        suggestLoad(
          three('60', 12),
          double({ targetRepsMin: null, targetRepsMax: null }),
        ),
      ).toBeNull();
    });

    it('sem séries', () => {
      expect(suggestLoad([], double())).toBeNull();
    });
  });
});
