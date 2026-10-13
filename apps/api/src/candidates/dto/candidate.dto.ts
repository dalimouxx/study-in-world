import { CandidateStatus } from '@prisma/client';
import { Transform } from 'class-transformer';
import { IsDateString, IsEmail, IsEnum, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { PaginationQuery } from '../../common/pagination';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);

export class CreateCandidateDto {
  @Transform(trim) @IsString() @MinLength(1) @MaxLength(80) firstName!: string;
  @Transform(trim) @IsString() @MinLength(1) @MaxLength(80) lastName!: string;
  @Transform(trim) @IsString() @MinLength(4) @MaxLength(30) phone!: string;
  @IsOptional() @Transform(trim) @IsEmail() @MaxLength(254) email?: string;
  @IsOptional() @IsDateString() birthDate?: string;
  @IsOptional() @Transform(trim) @IsString() @MaxLength(60) nationality?: string;
  @IsOptional() @Transform(trim) @IsString() @MaxLength(40) passportNumber?: string;
  @IsOptional() @IsString() branchId?: string;
  @IsOptional() @IsString() assignedToId?: string;
}

export class UpdateCandidateDto {
  @IsOptional() @Transform(trim) @IsString() @MinLength(1) @MaxLength(80) firstName?: string;
  @IsOptional() @Transform(trim) @IsString() @MinLength(1) @MaxLength(80) lastName?: string;
  @IsOptional() @Transform(trim) @IsString() @MinLength(4) @MaxLength(30) phone?: string;
  @IsOptional() @Transform(trim) @IsEmail() @MaxLength(254) email?: string;
  @IsOptional() @IsDateString() birthDate?: string;
  @IsOptional() @Transform(trim) @IsString() @MaxLength(60) nationality?: string;
  @IsOptional() @Transform(trim) @IsString() @MaxLength(40) passportNumber?: string;
  @IsOptional() @IsEnum(CandidateStatus) status?: CandidateStatus;
  @IsOptional() @IsString() branchId?: string;
  @IsOptional() @IsString() assignedToId?: string;
  @IsOptional() @IsString() partnerId?: string;
}

export class ListCandidatesQuery extends PaginationQuery {
  @IsOptional() @Transform(trim) @IsString() search?: string;
  @IsOptional() @IsEnum(CandidateStatus) status?: CandidateStatus;
  @IsOptional() @IsString() assignedToId?: string;
}

export class AddNoteDto {
  @Transform(trim) @IsString() @MinLength(1) @MaxLength(2000) content!: string;
}
