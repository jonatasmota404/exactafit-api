import { IsISO8601, IsUUID, Matches } from 'class-validator';

// ISO 8601 com data, hora e fuso obrigatórios (Z ou ±hh:mm); o IsISO8601 estrito recusa datas impossíveis
export const ISO_COM_FUSO =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})$/;

export class CreateSessionDto {
  @IsUUID()
  id!: string;

  @IsUUID()
  routineId!: string;

  @IsISO8601({ strict: true, strictSeparator: true })
  @Matches(ISO_COM_FUSO, {
    message: 'startedAt deve ser ISO 8601 com fuso (Z ou ±hh:mm)',
  })
  startedAt!: string;
}
