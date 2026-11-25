import { IsISO8601, IsOptional, IsUUID, Matches } from 'class-validator';
import { DATE_ONLY } from '../../me/dto/update-profile.dto';

export class TodayQueryDto {
  // Mesmas regras de ListMealLogsDto; sem date vale hoje no fuso do perfil.
  @IsOptional()
  @Matches(DATE_ONLY)
  @IsISO8601({ strict: true })
  date?: string;

  @IsOptional()
  @IsUUID()
  dayTypeId?: string;
}
