import { ProspectSource, ProspectStatus } from '@prisma/client';
import { Transform, Type } from 'class-transformer';
import { IsDateString, IsEmail, IsEnum, IsNumber, IsOptional, IsString, Min, MaxLength, MinLength } from 'class-validator';
import { PaginationQuery } from '../../common/pagination';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);

export class CreateProspectDto {
  @Transform(trim) @IsString() @MinLength(1) @MaxLength(80) firstName!: string;
  @Transform(trim) @IsString() @MinLength(1) @MaxLength(80) lastName!: string;
  @Transform(trim) @IsString() @MinLength(4) @MaxLength(30) phone!: string;
  @IsOptional() @Transform(trim) @IsEmail() @MaxLength(254) email?: string;
  @IsOptional() @Transform(trim) @IsString() @MaxLength(80) city?: string;
  @IsOptional() @IsString() desiredCountryId?: string;
  @IsOptional() @Transform(trim) @IsString() @MaxLength(160) desiredProgram?: string;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) budget?: number;
  @IsOptional() @Transform(trim) @IsString() @MaxLength(120) campaign?: string;
  @IsOptional() @IsDateString() nextFollowUpAt?: string;
  @IsOptional() @IsEnum(ProspectSource) source?: ProspectSource;
  @IsOptional() @IsString() @MaxLength(2000) notes?: string;
  @IsOptional() @IsString() branchId?: string;
  @IsOptional() @IsString() assignedToId?: string;
  /** Si un doublon (même téléphone) existe déjà, il faut confirmer explicitement pour créer malgré tout. */
  @IsOptional() force?: boolean;
}

export class UpdateProspectDto {
  @IsOptional() @Transform(trim) @IsString() @MinLength(1) @MaxLength(80) firstName?: string;
  @IsOptional() @Transform(trim) @IsString() @MinLength(1) @MaxLength(80) lastName?: string;
  @IsOptional() @Transform(trim) @IsString() @MinLength(4) @MaxLength(30) phone?: string;
  @IsOptional() @Transform(trim) @IsEmail() @MaxLength(254) email?: string;
  @IsOptional() @Transform(trim) @IsString() @MaxLength(80) city?: string;
  @IsOptional() @IsString() desiredCountryId?: string;
  @IsOptional() @Transform(trim) @IsString() @MaxLength(160) desiredProgram?: string;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) budget?: number;
  @IsOptional() @Transform(trim) @IsString() @MaxLength(120) campaign?: string;
  @IsOptional() @IsDateString() nextFollowUpAt?: string;
  @IsOptional() @IsEnum(ProspectSource) source?: ProspectSource;
  @IsOptional() @IsEnum(ProspectStatus) status?: ProspectStatus;
  @IsOptional() @IsString() @MaxLength(2000) notes?: string;
  @IsOptional() @IsString() branchId?: string;
  @IsOptional() @IsString() assignedToId?: string;
}

export class ListProspectsQuery extends PaginationQuery {
  @IsOptional() @Transform(trim) @IsString() search?: string;
  @IsOptional() @IsEnum(ProspectStatus) status?: ProspectStatus;
  @IsOptional() @IsEnum(ProspectSource) source?: ProspectSource;
  @IsOptional() @IsString() assignedToId?: string;
}

export class AddNoteDto {
  @Transform(trim) @IsString() @MinLength(1) @MaxLength(2000) content!: string;
}
