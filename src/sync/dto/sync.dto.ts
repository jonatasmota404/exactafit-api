import {
  IsArray,
  IsISO8601,
  IsOptional,
  IsUUID,
  Matches,
  ValidateIf,
} from 'class-validator';
import {
  AnoUtcAte9999,
  CreateSessionDto,
  ISO_COM_FUSO,
} from '../../sessions/dto/create-session.dto';
import { CreateSetDto } from '../../sessions/dto/create-set.dto';

// Topo do lote: cada item é validado à parte (SyncService), para um item ruim não derrubar os outros.
// mealLogs entra no 17b; até lá, um mealLogs no corpo é campo desconhecido (400).
export class SyncDto {
  @IsOptional()
  @IsArray()
  sessions?: unknown[];

  @IsOptional()
  @IsArray()
  sets?: unknown[];
}

// Sessão do lote: CreateSessionDto + finishedAt (mesmo formato do UpdateSessionDto). null vale como ausente.
export class SyncSessionDto extends CreateSessionDto {
  @ValidateIf((o: SyncSessionDto) => o.finishedAt != null)
  @IsISO8601({ strict: true, strictSeparator: true })
  @Matches(ISO_COM_FUSO, {
    message: 'finishedAt deve ser ISO 8601 com fuso (Z ou ±hh:mm)',
  })
  @AnoUtcAte9999()
  finishedAt?: string | null;
}

// Série do lote: CreateSetDto + sessionId (na rota individual vem da URL).
export class SyncSetDto extends CreateSetDto {
  @IsUUID()
  sessionId!: string;
}
