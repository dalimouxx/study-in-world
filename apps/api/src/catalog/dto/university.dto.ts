import { Transform } from 'class-transformer';
import { IsBoolean, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { PaginationQuery } from '../../common/pagination';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);

export class CreateUniversityDto {
  @IsString() countryId!: string;
  @Transform(trim) @IsString() @MinLength(1) @MaxLength(160) name!: string;
  @IsOptional() @Transform(trim) @IsString() @MaxLength(80) slug?: string;
  @IsOptional() @IsString() @MaxLength(500) logoUrl?: string;
  @Transform(trim) @IsString() @MinLength(1) @MaxLength(80) city!: string;
  @IsOptional() @IsString() @MaxLength(300) address?: string;
  @IsOptional() @IsString() @MaxLength(300) website?: string;
  @IsOptional() @IsString() @MaxLength(254) email?: string;
  @IsOptional() @IsString() @MaxLength(40) phone?: string;
  @IsOptional() @IsBoolean() isPublic?: boolean;
  @IsOptional() @IsString() @MaxLength(8000) description?: string;
  @IsOptional() @IsString() @MaxLength(8000) feesInfo?: string;
  @IsOptional() @IsString() @MaxLength(8000) calendarInfo?: string;
  @IsOptional() @IsString() @MaxLength(8000) deadlinesInfo?: string;
  @IsOptional() @IsString() @MaxLength(8000) conditionsInfo?: string;
  @IsOptional() @IsString() @MaxLength(2000) languageLevel?: string;
  @IsOptional() @IsString() @MaxLength(8000) extraInfo?: string;
  @IsOptional() @IsBoolean() isActive?: boolean;
  @IsOptional() @IsBoolean() applicationsOpen?: boolean;
}

export class UpdateUniversityDto {
  @IsOptional() @IsString() countryId?: string;
  @IsOptional() @Transform(trim) @IsString() @MinLength(1) @MaxLength(160) name?: string;
  @IsOptional() @Transform(trim) @IsString() @MaxLength(80) slug?: string;
  @IsOptional() @IsString() @MaxLength(500) logoUrl?: string;
  @IsOptional() @Transform(trim) @IsString() @MinLength(1) @MaxLength(80) city?: string;
  @IsOptional() @IsString() @MaxLength(300) address?: string;
  @IsOptional() @IsString() @MaxLength(300) website?: string;
  @IsOptional() @IsString() @MaxLength(254) email?: string;
  @IsOptional() @IsString() @MaxLength(40) phone?: string;
  @IsOptional() @IsBoolean() isPublic?: boolean;
  @IsOptional() @IsString() @MaxLength(8000) description?: string;
  @IsOptional() @IsString() @MaxLength(8000) feesInfo?: string;
  @IsOptional() @IsString() @MaxLength(8000) calendarInfo?: string;
  @IsOptional() @IsString() @MaxLength(8000) deadlinesInfo?: string;
  @IsOptional() @IsString() @MaxLength(8000) conditionsInfo?: string;
  @IsOptional() @IsString() @MaxLength(2000) languageLevel?: string;
  @IsOptional() @IsString() @MaxLength(8000) extraInfo?: string;
  @IsOptional() @IsBoolean() isActive?: boolean;
  @IsOptional() @IsBoolean() applicationsOpen?: boolean;
}

export class ListUniversitiesQuery extends PaginationQuery {
  @IsOptional() @Transform(trim) @IsString() search?: string;
  @IsOptional() @IsString() countryId?: string;
  @IsOptional() includeInactive?: string;
}
