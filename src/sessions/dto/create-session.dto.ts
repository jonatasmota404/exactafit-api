import { IsISO8601, IsUUID, Matches, ValidateBy } from 'class-validator';

// ISO 8601 com data, hora e fuso obrigatórios (Z ou ±hh:mm); o IsISO8601 estrito recusa datas impossíveis
export const ISO_COM_FUSO =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})$/;

// Com o fuso, 9999-12-31T23:59-01:00 vira o ano 10000 em UTC, que o banco não devolve (lê como null).
export const AnoUtcAte9999 = () =>
  ValidateBy({
    name: 'anoUtcAte9999',
    validator: {
      validate: (v) =>
        typeof v === 'string' && new Date(v).getUTCFullYear() <= 9999,
      defaultMessage: () => '$property passa do ano 9999 em UTC',
    },
  });

export class CreateSessionDto {
  @IsUUID()
  id!: string;

  @IsUUID()
  routineId!: string;

  @IsISO8601({ strict: true, strictSeparator: true })
  @Matches(ISO_COM_FUSO, {
    message: 'startedAt deve ser ISO 8601 com fuso (Z ou ±hh:mm)',
  })
  @AnoUtcAte9999()
  startedAt!: string;
}
