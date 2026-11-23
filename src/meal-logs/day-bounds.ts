const SEC = 1000;
const HOUR = 3600 * SEC;
const MAX_HOURS = 56;

// Início do dia D: primeiro instante cuja data local no fuso é D. Intervalo [start, end).
export function dayBounds(
  date: string,
  timeZone: string,
): { start: Date; end: Date } {
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone,
    era: 'short',
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
  });
  // Data local como número ano*10000+mês*100+dia (comparável; ano ≤ 0 vira 1 - ano da era).
  const localKey = (ms: number) => {
    const p = Object.fromEntries(
      fmt.formatToParts(ms).map((x) => [x.type, x.value]),
    );
    const y = /^b/i.test(p.era) ? 1 - Number(p.year) : Number(p.year);
    return y * 10000 + Number(p.month) * 100 + Number(p.day);
  };
  const utcMidnight = (y: number, m: number, d: number) => {
    const t = new Date(0); // setUTCFullYear evita que ano 0..99 vire 1900..1999
    t.setUTCFullYear(y, m - 1, d);
    return t;
  };
  const keyOf = (t: Date) =>
    t.getUTCFullYear() * 10000 + (t.getUTCMonth() + 1) * 100 + t.getUTCDate();

  const startOf = (day: Date) => {
    const target = keyOf(day);
    // Nenhum deslocamento (nem LMT, até +15:13) chega a 24h: em (00:00Z - 24h) a data local é anterior a D.
    let t = day.getTime() - 24 * HOUR;
    if (localKey(t) >= target) throw new Error('Dia fora do alcance do fuso');
    for (let i = 0; localKey(t + HOUR) < target; i++) {
      if (i >= MAX_HOURS) throw new Error('Dia fora do alcance do fuso');
      t += HOUR;
    }
    // t ainda não chegou em D e t + 1h chegou: busca o segundo exato.
    let lo = 0;
    let hi = 3600;
    while (hi - lo > 1) {
      const mid = (lo + hi) >> 1;
      if (localKey(t + mid * SEC) >= target) hi = mid;
      else lo = mid;
    }
    return t + hi * SEC;
  };

  const [y, m, d] = date.split('-').map(Number);
  const day = utcMidnight(y, m, d);
  const next = new Date(day);
  next.setUTCDate(next.getUTCDate() + 1);
  return { start: new Date(startOf(day)), end: new Date(startOf(next)) };
}
