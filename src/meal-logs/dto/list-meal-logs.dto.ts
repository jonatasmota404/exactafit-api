import { IsISO8601, Matches } from 'class-validator';
import { DATE_ONLY } from '../../me/dto/update-profile.dto';

export class ListMealLogsDto {
  // strict recusa data impossível (2026-02-30).
  @Matches(DATE_ONLY)
  @IsISO8601({ strict: true })
  date!: string;
}
