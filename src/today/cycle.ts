// Tarefa 15 (C3–C6): qual semana e qual dia do ciclo valem numa data.
export type CycleProgram = {
  cycleType: 'WEEKLY' | 'ROTATING';
  cycleDays: number;
  weeks: number;
  startDate: string; // AAAA-MM-DD
};

const DAY_MS = 86_400_000;
const utcDay = (s: string) => {
  const [y, m, d] = s.split('-').map(Number);
  const t = new Date(0); // setUTCFullYear evita que ano 0..99 vire 1900..1999
  t.setUTCFullYear(y, m - 1, d);
  return Math.round(t.getTime() / DAY_MS);
};

// Semana e dia do ciclo que valem em `date` (AAAA-MM-DD); null antes do startDate.
export function cycleDay(
  program: CycleProgram,
  date: string,
): { week: number; day: number } | null {
  const start = utcDay(program.startDate);
  const k = utcDay(date) - start;
  if (k < 0) return null;
  if (program.cycleType === 'ROTATING') {
    return { week: 1, day: (k % program.cycleDays) + 1 };
  }
  // 1970-01-01 (dia 0) foi quinta: (n + 3) % 7 = 0 na segunda.
  const sinceMonday = k + ((((start + 3) % 7) + 7) % 7);
  return {
    week: (Math.floor(sinceMonday / 7) % program.weeks) + 1,
    day: (sinceMonday % 7) + 1,
  };
}
