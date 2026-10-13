import { ApplicationStatus } from '@prisma/client';
import { Transform } from 'class-transformer';
import { IsDateString, IsEnum, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);

/**
 * `programId` : lien vers un programme réel du catalogue (Phase 4). Quand il est fourni, country/university/program
 * sont dérivés automatiquement si absents. Sans `programId`, ces trois champs texte deviennent obligatoires
 * (candidature vers un établissement non encore catalogué) — vérifié dans le service, pas ici.
 */
export class CreateApplicationDto {
  @IsOptional() @IsString() programId?: string;
  @IsOptional() @Transform(trim) @IsString() @MinLength(1) @MaxLength(80) country?: string;
  @IsOptional() @Transform(trim) @IsString() @MinLength(1) @MaxLength(160) university?: string;
  @IsOptional() @Transform(trim) @IsString() @MinLength(1) @MaxLength(160) program?: string;
  @Transform(trim) @IsString() @MinLength(1) @MaxLength(40) intake!: string;
  @IsOptional() @IsDateString() deadline?: string;
  @IsOptional() @IsString() @MaxLength(2000) notes?: string;
}

export class UpdateApplicationDto {
  @IsOptional() @IsString() programId?: string;
  @IsOptional() @Transform(trim) @IsString() @MinLength(1) @MaxLength(80) country?: string;
  @IsOptional() @Transform(trim) @IsString() @MinLength(1) @MaxLength(160) university?: string;
  @IsOptional() @Transform(trim) @IsString() @MinLength(1) @MaxLength(160) program?: string;
  @IsOptional() @Transform(trim) @IsString() @MinLength(1) @MaxLength(40) intake?: string;
  @IsOptional() @IsDateString() deadline?: string;
  @IsOptional() @IsEnum(ApplicationStatus) status?: ApplicationStatus;
  @IsOptional() @IsDateString() submittedAt?: string;
  @IsOptional() @IsDateString() decisionAt?: string;
  @IsOptional() @IsString() @MaxLength(2000) notes?: string;
}
