import { Transform } from 'class-transformer';
import { IsBoolean, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { PaginationQuery } from '../../common/pagination';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);

export class CreateCountryDto {
  @Transform(trim) @IsString() @MinLength(1) @MaxLength(80) name!: string;
  @IsOptional() @Transform(trim) @IsString() @MaxLength(80) slug?: string;
  @IsOptional() @IsString() @MaxLength(8) flagEmoji?: string;
  @IsOptional() @IsString() @MaxLength(500) imageUrl?: string;
  @IsOptional() @IsString() @MaxLength(8000) description?: string;
  @IsOptional() @IsString() @MaxLength(8000) universitySystem?: string;
  @IsOptional() @IsString() @MaxLength(8000) advantages?: string;
  @IsOptional() @IsString() @MaxLength(8000) costOfLiving?: string;
  @IsOptional() @IsString() @MaxLength(8000) tuitionFeesInfo?: string;
  @IsOptional() @IsString() @MaxLength(2000) languages?: string;
  @IsOptional() @IsString() @MaxLength(8000) admissionConditions?: string;
  @IsOptional() @IsString() @MaxLength(2000) languageLevel?: string;
  @IsOptional() @IsString() @MaxLength(8000) applicationProcess?: string;
  @IsOptional() @IsString() @MaxLength(8000) visaInfo?: string;
  @IsOptional() @IsString() @MaxLength(8000) housingInfo?: string;
  @IsOptional() @IsString() @MaxLength(8000) insuranceInfo?: string;
  @IsOptional() @IsString() @MaxLength(8000) studentWorkInfo?: string;
  @IsOptional() @IsString() @MaxLength(8000) transportInfo?: string;
  @IsOptional() @IsString() @MaxLength(8000) calendarInfo?: string;
  @IsOptional() @IsString() @MaxLength(8000) documentsInfo?: string;
  @IsOptional() @IsString() @MaxLength(8000) faq?: string;
  @IsOptional() @IsBoolean() isActive?: boolean;
}

export class UpdateCountryDto {
  @IsOptional() @Transform(trim) @IsString() @MinLength(1) @MaxLength(80) name?: string;
  @IsOptional() @Transform(trim) @IsString() @MaxLength(80) slug?: string;
  @IsOptional() @IsString() @MaxLength(8) flagEmoji?: string;
  @IsOptional() @IsString() @MaxLength(500) imageUrl?: string;
  @IsOptional() @IsString() @MaxLength(8000) description?: string;
  @IsOptional() @IsString() @MaxLength(8000) universitySystem?: string;
  @IsOptional() @IsString() @MaxLength(8000) advantages?: string;
  @IsOptional() @IsString() @MaxLength(8000) costOfLiving?: string;
  @IsOptional() @IsString() @MaxLength(8000) tuitionFeesInfo?: string;
  @IsOptional() @IsString() @MaxLength(2000) languages?: string;
  @IsOptional() @IsString() @MaxLength(8000) admissionConditions?: string;
  @IsOptional() @IsString() @MaxLength(2000) languageLevel?: string;
  @IsOptional() @IsString() @MaxLength(8000) applicationProcess?: string;
  @IsOptional() @IsString() @MaxLength(8000) visaInfo?: string;
  @IsOptional() @IsString() @MaxLength(8000) housingInfo?: string;
  @IsOptional() @IsString() @MaxLength(8000) insuranceInfo?: string;
  @IsOptional() @IsString() @MaxLength(8000) studentWorkInfo?: string;
  @IsOptional() @IsString() @MaxLength(8000) transportInfo?: string;
  @IsOptional() @IsString() @MaxLength(8000) calendarInfo?: string;
  @IsOptional() @IsString() @MaxLength(8000) documentsInfo?: string;
  @IsOptional() @IsString() @MaxLength(8000) faq?: string;
  @IsOptional() @IsBoolean() isActive?: boolean;
}

export class ListCountriesQuery extends PaginationQuery {
  @IsOptional() @Transform(trim) @IsString() search?: string;
  @IsOptional() includeInactive?: string;
}
