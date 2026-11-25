export type CycleProgram = {
  cycleType: 'WEEKLY' | 'ROTATING';
  cycleDays: number;
  weeks: number;
  startDate: string; // AAAA-MM-DD
};

// Semana e dia do ciclo que valem em `date` (AAAA-MM-DD); null antes do startDate.
export function cycleDay(
  program: CycleProgram,
  date: string,
): { week: number; day: number } | null {
  void program;
  void date;
  throw new Error('não implementado');
}
