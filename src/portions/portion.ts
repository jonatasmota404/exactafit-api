// Cálculo da porção (docs/domain.md, item (c) "Porção" e M7). Função pura, sem dependência
// de Nest nem de Prisma, para o front (PWA, ADR 0012) executar a mesma conta sem rede.

export type PortionTargetType = 'KCAL' | 'PROTEIN' | 'CARBS' | 'WEIGHT';
type Value = string | number;
export type FoodPer100g = { kcal: Value; proteinG: Value; carbsG: Value };

const FIELD = { KCAL: 'kcal', PROTEIN: 'proteinG', CARBS: 'carbsG' } as const;

// Valor ≥ 0 com até 1 casa (formato da API) → décimos inteiros, para a conta não ter
// erro de ponto flutuante (0.3 / 0.8 * 100 dá 37.49999999999999).
function tenths(v: Value): number {
  const s = typeof v === 'number' && Number.isFinite(v) ? String(v) : v;
  const m = typeof s === 'string' ? /^(\d+)(?:\.(\d))?$/.exec(s) : null;
  if (!m) throw new RangeError(`Valor inválido: ${String(v)}`);
  return Number(m[1]) * 10 + Number(m[2] ?? 0);
}

/**
 * Gramas do alimento para atingir a meta, arredondadas para a grama inteira (meio para
 * cima). Meta de peso: o próprio peso. `null` ("sem cálculo") quando o alimento tem 0 no
 * nutriente da meta.
 */
export function portionGrams(
  targetType: PortionTargetType,
  targetValue: Value,
  food: FoodPer100g,
): number | null {
  const target = tenths(targetValue);
  if (targetType === 'WEIGHT') return Math.floor((target + 5) / 10);
  const per100 = tenths(food[FIELD[targetType]]);
  if (per100 === 0) return null;
  // target ÷ per100 × 100, com o meio para cima, só em inteiros.
  return Math.floor((200 * target + per100) / (2 * per100));
}
