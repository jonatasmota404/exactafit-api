// Tarefa 15 (C3–C6): qual semana e qual dia do ciclo valem numa data.
// Semanal: dia 1 = segunda … 7 = domingo; semana 1 = semana (seg–dom) que contém o startDate.
// Rotativo: startDate é o dia 1. Antes do startDate: sem dia do ciclo.
import { cycleDay } from './cycle';

const weekly = (weeks: number, startDate: string) => ({
  cycleType: 'WEEKLY' as const,
  cycleDays: 7,
  weeks,
  startDate,
});
const rotating = (cycleDays: number, startDate: string) => ({
  cycleType: 'ROTATING' as const,
  cycleDays,
  weeks: 1,
  startDate,
});

describe('cycleDay', () => {
  it('C3: semanal de 1 semana — segunda é o dia 1 e domingo o dia 7', () => {
    const p = weekly(1, '2026-11-16'); // segunda
    expect(cycleDay(p, '2026-11-23')).toEqual({ week: 1, day: 1 }); // segunda
    expect(cycleDay(p, '2026-11-25')).toEqual({ week: 1, day: 3 }); // quarta
    expect(cycleDay(p, '2026-11-29')).toEqual({ week: 1, day: 7 }); // domingo
  });

  it('C4: semanal A-B com startDate numa quarta — a semana vira na segunda e volta para a 1', () => {
    const p = weekly(2, '2026-11-25'); // quarta
    expect(cycleDay(p, '2026-11-25')).toEqual({ week: 1, day: 3 });
    expect(cycleDay(p, '2026-11-29')).toEqual({ week: 1, day: 7 }); // domingo da mesma semana
    expect(cycleDay(p, '2026-11-30')).toEqual({ week: 2, day: 1 }); // segunda seguinte
    expect(cycleDay(p, '2026-12-06')).toEqual({ week: 2, day: 7 });
    expect(cycleDay(p, '2026-12-07')).toEqual({ week: 1, day: 1 }); // outra segunda
  });

  it('C5: rotativo de 3 dias — startDate é o dia 1 e o ciclo se repete', () => {
    const p = rotating(3, '2026-11-25');
    expect(cycleDay(p, '2026-11-25')).toEqual({ week: 1, day: 1 }); // k = 0
    expect(cycleDay(p, '2026-11-27')).toEqual({ week: 1, day: 3 }); // k = 2
    expect(cycleDay(p, '2026-11-28')).toEqual({ week: 1, day: 1 }); // k = 3
    expect(cycleDay(p, '2026-12-02')).toEqual({ week: 1, day: 2 }); // k = 7
  });

  it('C5: rotativo atravessa a virada do ano sem erro de fuso', () => {
    const p = rotating(4, '2026-12-30');
    expect(cycleDay(p, '2027-01-03')).toEqual({ week: 1, day: 1 }); // k = 4
  });

  it('C6: data anterior ao startDate não tem dia do ciclo', () => {
    expect(cycleDay(weekly(1, '2026-11-25'), '2026-11-24')).toBeNull();
    expect(cycleDay(weekly(2, '2026-11-25'), '2026-11-23')).toBeNull(); // mesma semana, antes
    expect(cycleDay(rotating(3, '2026-11-25'), '2026-11-24')).toBeNull();
  });
});
