import { Transform } from 'class-transformer';
import { IsString, MaxLength, MinLength } from 'class-validator';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);

export class DraftCountryContentDto {
  @Transform(trim) @IsString() @MinLength(1) @MaxLength(80) name!: string;
}

export class DraftUniversityContentDto {
  @Transform(trim) @IsString() @MinLength(1) @MaxLength(160) name!: string;
  @Transform(trim) @IsString() @MinLength(1) @MaxLength(80) city!: string;
  @Transform(trim) @IsString() @MinLength(1) @MaxLength(80) countryName!: string;
}
