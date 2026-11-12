// Tarefa 10b-2: parser de CSV (C15, C19, C23). Plano: docs/plans/2026-11-12-rendimento-e-csv.md.
import { CsvSyntaxError, parseCsv, parseDecimal } from './csv';

describe('parseCsv', () => {
  it('detecta ";" pelo cabeçalho e separa os campos', () => {
    const rows = parseCsv('name;state\nArroz, branco;COOKED\n');
    expect(rows).toEqual([
      { line: 1, fields: ['name', 'state'] },
      { line: 2, fields: ['Arroz, branco', 'COOKED'] },
    ]);
  });

  it('sem ";" no cabeçalho, separa por ","', () => {
    const rows = parseCsv('name,state\r\nArroz;x,COOKED\r\n');
    expect(rows).toEqual([
      { line: 1, fields: ['name', 'state'] },
      { line: 2, fields: ['Arroz;x', 'COOKED'] },
    ]);
  });

  it('C15: campo entre aspas com separador e aspas escapadas', () => {
    const rows = parseCsv(
      'name,state\n"Arroz, integral",RAW\n"Pão ""francês""",COOKED',
    );
    expect(rows[1].fields).toEqual(['Arroz, integral', 'RAW']);
    expect(rows[2].fields).toEqual(['Pão "francês"', 'COOKED']);
  });

  it('C23: "4,8" entre aspas no modo "," fica um campo só', () => {
    const rows = parseCsv('name,proteinG\nFeijão,"4,8"\n');
    expect(rows[1].fields).toEqual(['Feijão', '4,8']);
  });

  it('C19: quebra de linha dentro de aspas; a linha é a física onde o registro começa', () => {
    const rows = parseCsv(
      'name,state\n"Arroz\ncozido",COOKED\nFeijão,COOKED\n',
    );
    expect(rows).toEqual([
      { line: 1, fields: ['name', 'state'] },
      { line: 2, fields: ['Arroz\ncozido', 'COOKED'] },
      { line: 4, fields: ['Feijão', 'COOKED'] },
    ]);
  });

  it('C20: linhas em branco são ignoradas, mas contam na numeração', () => {
    const rows = parseCsv('name,state\n\nArroz,RAW\n\r\n\nFeijão,RAW\n\n');
    expect(rows).toEqual([
      { line: 1, fields: ['name', 'state'] },
      { line: 3, fields: ['Arroz', 'RAW'] },
      { line: 6, fields: ['Feijão', 'RAW'] },
    ]);
  });

  it('campo vazio vira texto vazio', () => {
    const rows = parseCsv('a,b,c\n1,,3\n');
    expect(rows[1].fields).toEqual(['1', '', '3']);
  });

  it('C19: aspas sem fechar dão CsvSyntaxError com a linha onde o registro começa', () => {
    let error: unknown;
    try {
      parseCsv('name,state\nArroz,RAW\n"Feijão,COOKED\nOvo,COOKED\n');
    } catch (e) {
      error = e;
    }
    expect(error).toBeInstanceOf(CsvSyntaxError);
    expect((error as CsvSyntaxError).line).toBe(3);
  });

  it('texto depois das aspas de fechamento dá CsvSyntaxError na linha (achado do revisor)', () => {
    for (const text of ['a,b\n"x"y,2', 'a,b\n1,"x" \n']) {
      let error: unknown;
      try {
        parseCsv(text);
      } catch (e) {
        error = e;
      }
      expect(error).toBeInstanceOf(CsvSyntaxError);
      expect((error as CsvSyntaxError).line).toBe(2);
    }
  });

  it('aspas de fechamento seguidas de separador, \\r\\n ou fim do texto continuam válidas', () => {
    expect(parseCsv('a,b\n"x","y"\r\n"z",w').map((r) => r.fields)).toEqual([
      ['a', 'b'],
      ['x', 'y'],
      ['z', 'w'],
    ]);
  });

  it('texto vazio dá lista vazia', () => {
    expect(parseCsv('')).toEqual([]);
    expect(parseCsv('\n\n')).toEqual([]);
  });
});

describe('parseDecimal', () => {
  it.each([
    ['12', 12],
    ['0', 0],
    ['12.5', 12.5],
    ['12,5', 12.5],
    ['4,8', 4.8],
    ['900', 900],
    ['12.55', 12.55],
  ])('aceita %p → %p', (input, expected) => {
    expect(parseDecimal(input)).toBe(expected);
  });

  it.each([
    '',
    ' 12 ',
    '1e2',
    '-1',
    '+1',
    '0x10',
    'Infinity',
    'NaN',
    '1.2.3',
    '1,2,3',
    '.5',
    '5.',
    'abc',
    '1 000',
  ])('recusa %p', (input) => {
    expect(parseDecimal(input)).toBeUndefined();
  });
});
