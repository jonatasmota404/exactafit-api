// Parser de CSV (RFC 4180) para a importação de alimentos (A9).
export class CsvSyntaxError extends Error {
  constructor(
    message: string,
    readonly line: number,
  ) {
    super(message);
  }
}

export interface CsvRecord {
  line: number;
  fields: string[];
}

export function parseCsv(text: string): CsvRecord[] {
  const firstLine = text.split('\n').find((l) => l.trim() !== '') ?? '';
  const sep = firstLine.includes(';') ? ';' : ',';
  const records: CsvRecord[] = [];
  let line = 1;
  let startLine = 1;
  let fields: string[] = [];
  let field = '';
  let quoted = false; // dentro de aspas
  let touched = false; // o registro atual tem algo além de espaço de quebra

  const endRecord = () => {
    if (touched || fields.length > 0 || field !== '') {
      fields.push(field);
      records.push({ line: startLine, fields });
    }
    fields = [];
    field = '';
    touched = false;
  };

  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else quoted = false;
      } else {
        if (c === '\n') line++;
        field += c;
      }
      continue;
    }
    if (c === '\n') {
      endRecord();
      line++;
      startLine = line;
    } else if (c === '\r' && text[i + 1] === '\n') {
      // o \n seguinte encerra o registro
    } else if (c === '"' && field === '') {
      quoted = true;
      touched = true;
    } else if (c === sep) {
      fields.push(field);
      field = '';
      touched = true;
    } else {
      field += c;
    }
  }
  if (quoted) {
    throw new CsvSyntaxError('Aspas sem fechar', startLine);
  }
  endRecord();
  return records;
}

// Só dígitos com um separador decimal opcional (',' ou '.').
export function parseDecimal(s: string): number | undefined {
  if (!/^\d+([.,]\d+)?$/.test(s)) return undefined;
  return Number(s.replace(',', '.'));
}
