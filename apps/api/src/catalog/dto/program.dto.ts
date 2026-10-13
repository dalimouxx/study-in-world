import { ProgramLevel } from '@prisma/client';
import { Transform, Type } from 'class-transformer';
import { IsBoolean, IsDateString, IsEnum, IsNumber, IsOptional, IsString, Max, MaxLength, Min, MinLength } from 'class-validator';
import { PaginationQuery } from '../../common/pagination';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);

export class CreateProgramDto {
  @IsString() universityId!: string;
  @Transform(trim) @IsString() @MinLength(1) @MaxLength(200) name!: string;
  @IsOptional() @Transform(trim) @IsString() @MaxLength(80) slug?: string;
  @IsEnum(ProgramLevel) level!: ProgramLevel;
  @IsOptional() @IsString() @MaxLength(120) domain?: string;
  @IsOptional() @IsString() @MaxLength(120) specialty?: string;
  @IsOptional() @IsString() @MaxLength(60) language?: string;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(1) @Max(120) durationMonths?: number;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) credits?: number;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) tuitionFees?: number;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) applicationFees?: number;
  @IsOptional() @IsString() @MaxLength(8) currency?: string;
  @IsOptional() @IsDateString() openDate?: string;
  @IsOptional() @IsDateString() deadline?: string;
  @IsOptional() @IsString() @MaxLength(60) intake?: string;
  @IsOptional() @IsString() @MaxLength(4000) academicConditions?: string;
  @IsOptional() @IsString() @MaxLength(4000) prerequisites?: string;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) @Max(9) minIelts?: number;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) @Max(120) minToefl?: number;
  @IsOptional() @IsString() @MaxLength(2000) otherCertificates?: string;
  @IsOptional() @IsString() @MaxLength(4000) documentsRequired?: string;
  @IsOptional() @IsString() @MaxLength(8000) description?: string;
  @IsOptional() @IsString() @MaxLength(4000) outcomes?: string;
  @IsOptional() @IsString() @MaxLength(300) officialUrl?: string;
  @IsOptional() @IsBoolean() isActive?: boolean;
}

export class UpdateProgramDto {
  @IsOptional() @IsString() universityId?: string;
  @IsOptional() @Transform(trim) @IsString() @MinLength(1) @MaxLength(200) name?: string;
  @IsOptional() @Transform(trim) @IsString() @MaxLength(80) slug?: string;
  @IsOptional() @IsEnum(ProgramLevel) level?: ProgramLevel;
  @IsOptional() @IsString() @MaxLength(120) domain?: string;
  @IsOptional() @IsString() @MaxLength(120) specialty?: string;
  @IsOptional() @IsString() @MaxLength(60) language?: string;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(1) @Max(120) durationMonths?: number;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) credits?: number;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) tuitionFees?: number;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) applicationFees?: number;
  @IsOptional() @IsString() @MaxLength(8) currency?: string;
  @IsOptional() @IsDateString() openDate?: string;
  @IsOptional() @IsDateString() deadline?: string;
  @IsOptional() @IsString() @MaxLength(60) intake?: string;
  @IsOptional() @IsString() @MaxLength(4000) academicConditions?: string;
  @IsOptional() @IsString() @MaxLength(4000) prerequisites?: string;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) @Max(9) minIelts?: number;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) @Max(120) minToefl?: number;
  @IsOptional() @IsString() @MaxLength(2000) otherCertificates?: string;
  @IsOptional() @IsString() @MaxLength(4000) documentsRequired?: string;
  @IsOptional() @IsString() @MaxLength(8000) description?: string;
  @IsOptional() @IsString() @MaxLength(4000) outcomes?: string;
  @IsOptional() @IsString() @MaxLength(300) officialUrl?: string;
  @IsOptional() @IsBoolean() isActive?: boolean;
}

export class SearchProgramsQuery extends PaginationQuery {
  @IsOptional() @Transform(trim) @IsString() search?: string;
  @IsOptional() @IsString() countryId?: string;
  @IsOptional() @IsString() universityId?: string;
  @IsOptional() @Transform(trim) @IsString() city?: string;
  @IsOptional() @IsEnum(ProgramLevel) level?: ProgramLevel;
  @IsOptional() @Transform(trim) @IsString() domain?: string;
  @IsOptional() @Transform(trim) @IsString() language?: string;
  @IsOptional() @IsString() intake?: string;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) maxBudget?: number;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) @Max(9) ielts?: number;
  @IsOptional() isPublic?: string;
  @IsOptional() includeInactive?: string;
}
