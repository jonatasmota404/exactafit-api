import { IsISO8601, Matches, ValidateIf } from 'class-validator';
import { AnoUtcAte9999, ISO_COM_FUSO } from './create-session.dto';

const msg = 'deve ser ISO 8601 com fuso (Z ou ±hh:mm)';

// Sem IsOptional: null é rejeitado (não reabre a sessão); só undefined é pulado.
export class UpdateSessionDto {
  @ValidateIf((o: UpdateSessionDto) => o.startedAt !== undefined)
  @IsISO8601({ strict: true, strictSeparator: true })
  @Matches(ISO_COM_FUSO, { message: `startedAt ${msg}` })
  @AnoUtcAte9999()
  startedAt?: string;

  @ValidateIf((o: UpdateSessionDto) => o.finishedAt !== undefined)
  @IsISO8601({ strict: true, strictSeparator: true })
  @Matches(ISO_COM_FUSO, { message: `finishedAt ${msg}` })
  @AnoUtcAte9999()
  finishedAt?: string;
}
