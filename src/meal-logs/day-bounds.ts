const MIN = 60_000;
const HOUR = 60 * MIN;

// Início do dia D: primeiro instante cuja data local no fuso é D. Intervalo [start, end).
export function dayBounds(
  date: string,
  timeZone: string,
): { start: Date; end: Date } {
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const localDate = (ms: number) => fmt.format(ms); // AAAA-MM-DD
  const startOf = (day: string) => {
    // O maior deslocamento é UTC+14: às (00:00Z - 14h) a data local já é, no mínimo, D-1.
    let t = Date.parse(`${day}T00:00:00Z`) - 14 * HOUR;
    if (localDate(t) >= day) return t;
    while (localDate(t + HOUR) < day) t += HOUR;
    // Aqui t não chegou em D e t + 1h chegou: busca o minuto exato (deslocamentos em minutos).
    let lo = 0; // minutos a partir de t, ainda antes de D
    let hi = 60; // já em D
    while (hi - lo > 1) {
      const mid = (lo + hi) >> 1;
      if (localDate(t + mid * MIN) >= day) hi = mid;
      else lo = mid;
    }
    return t + hi * MIN;
  };
  const next = new Date(Date.parse(`${date}T00:00:00Z`) + 24 * HOUR)
    .toISOString()
    .slice(0, 10);
  return { start: new Date(startOf(date)), end: new Date(startOf(next)) };
}
