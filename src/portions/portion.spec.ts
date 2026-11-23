// Tarefa 12: cálculo da porção como função pura (docs/domain.md, item (c) "Porção" e M7).
import { portionGrams } from './portion';

const arroz = { kcal: '130', proteinG: '2.5', carbsG: '28' };
const frango = { kcal: '159', proteinG: '32', carbsG: '0' };

describe('portionGrams', () => {
  it('kcal: arroz a 130 kcal/100 g dá 146 g para 190 kcal e 115 g para 150 kcal (exemplos do domain.md)', () => {
    expect(portionGrams('KCAL', '190', arroz)).toBe(146);
    expect(portionGrams('KCAL', '150', arroz)).toBe(115);
  });

  it('proteína e carboidrato dividem pelo nutriente da meta', () => {
    expect(portionGrams('PROTEIN', '40', frango)).toBe(125);
    // 50 ÷ 28 × 100 = 178,57 → 179
    expect(portionGrams('CARBS', '50', arroz)).toBe(179);
  });

  it('arredonda para a grama inteira, com o meio para cima', () => {
    // 2 ÷ 80 × 100 = 2,5 → 3
    expect(portionGrams('KCAL', '2', { ...arroz, kcal: '80' })).toBe(3);
    // 1 ÷ 200 × 100 = 0,5 → 1
    expect(portionGrams('KCAL', '1', { ...arroz, kcal: '200' })).toBe(1);
    // 0,1 ÷ 0,3 × 100 = 33,33 → 33
    expect(portionGrams('PROTEIN', '0.1', { ...arroz, proteinG: '0.3' })).toBe(
      33,
    );
  });

  it('conta em décimos inteiros, sem erro de ponto flutuante', () => {
    // 12,3 ÷ 4,1 × 100 = 300 exatos (em float, 12.3 / 4.1 * 100 = 300.00000000000006)
    expect(portionGrams('CARBS', '12.3', { ...arroz, carbsG: '4.1' })).toBe(
      300,
    );
    // 0,3 ÷ 0,8 × 100 = 37,5 → 38 (em float, 0.3 / 0.8 * 100 = 37.49999999999999 → 37)
    expect(portionGrams('PROTEIN', '0.3', { ...arroz, proteinG: '0.8' })).toBe(
      38,
    );
    // 0,7 ÷ 20 × 100 = 3,5 → 4 (em float, 3.4999999999999996 → 3)
    expect(portionGrams('CARBS', '0.7', { ...arroz, carbsG: '20' })).toBe(4);
  });

  it('meta de peso: a porção é o próprio peso, arredondado; vale para qualquer alimento', () => {
    expect(portionGrams('WEIGHT', '200', frango)).toBe(200);
    expect(portionGrams('WEIGHT', '199.5', frango)).toBe(200);
    expect(portionGrams('WEIGHT', '199.4', frango)).toBe(199);
    expect(
      portionGrams('WEIGHT', '150', { kcal: '0', proteinG: '0', carbsG: '0' }),
    ).toBe(150);
  });

  it('alimento com 0 no nutriente da meta → null ("sem cálculo", M7)', () => {
    expect(portionGrams('CARBS', '50', frango)).toBeNull();
    expect(
      portionGrams('PROTEIN', '30', { ...arroz, proteinG: '0' }),
    ).toBeNull();
    expect(portionGrams('KCAL', '100', { ...arroz, kcal: '0.0' })).toBeNull();
  });

  it('meta 0 → 0 g', () => {
    expect(portionGrams('KCAL', '0', arroz)).toBe(0);
    expect(portionGrams('WEIGHT', '0', arroz)).toBe(0);
  });

  it('aceita número ou texto (formato da API) com o mesmo resultado', () => {
    expect(
      portionGrams('KCAL', 190, { kcal: 130, proteinG: 2.5, carbsG: 28 }),
    ).toBe(146);
    expect(portionGrams('CARBS', 12.3, { ...arroz, carbsG: 4.1 })).toBe(300);
  });

  it('entrada fora do formato (negativa, mais de 1 casa, texto, NaN, infinito) → RangeError', () => {
    for (const bad of ['-1', '1.25', 'abc', '', NaN, Infinity, -0.5]) {
      expect(() => portionGrams('KCAL', bad, arroz)).toThrow(RangeError);
      expect(() => portionGrams('KCAL', '10', { ...arroz, kcal: bad })).toThrow(
        RangeError,
      );
    }
  });
});
