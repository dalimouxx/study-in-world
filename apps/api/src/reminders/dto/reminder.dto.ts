import { IsDateString, IsIn, IsOptional, IsString, MaxLength, ValidateIf } from 'class-validator';

export class TodayQueryDto {
  @IsOptional() @IsIn(['mine', 'all']) scope?: 'mine' | 'all';
}

export class ReminderDoneDto {
  @IsString() @MaxLength(200) key!: string;
  /** Prospect seulement : date de la prochaine relance ; `null` = aucune ; absent = inchangée. */
  @IsOptional() @ValidateIf((_o, v) => v !== null) @IsDateString() nextFollowUpAt?: string | null;
}
