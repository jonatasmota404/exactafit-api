// Tarefa 13a-2 (C9): limites do dia no fuso do perfil.
// Início do dia D = primeiro instante UTC cuja data local é D; intervalo [início(D), início(D+1)).
import { dayBounds } from './day-bounds';

describe('dayBounds', () => {
  it('America/Santiago em 2026-09-06: a meia-noite não existe, o dia começa à 01:00 local', () => {
    const { start, end } = dayBounds('2026-09-06', 'America/Santiago');
    expect(start.toISOString()).toBe('2026-09-06T04:00:00.000Z');
    expect(end.toISOString()).toBe('2026-09-07T03:00:00.000Z');
  });

  it('America/Sao_Paulo em 2026-11-23 começa às 03:00 UTC', () => {
    const { start, end } = dayBounds('2026-11-23', 'America/Sao_Paulo');
    expect(start.toISOString()).toBe('2026-11-23T03:00:00.000Z');
    expect(end.toISOString()).toBe('2026-11-24T03:00:00.000Z');
  });

  it('Asia/Tokyo em 2026-11-24 começa às 15:00 UTC do dia anterior', () => {
    const { start, end } = dayBounds('2026-11-24', 'Asia/Tokyo');
    expect(start.toISOString()).toBe('2026-11-23T15:00:00.000Z');
    expect(end.toISOString()).toBe('2026-11-24T15:00:00.000Z');
  });
});
