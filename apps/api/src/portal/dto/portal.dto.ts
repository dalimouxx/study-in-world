import { Transform } from 'class-transformer';
import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);

export class UpdatePortalProfileDto {
  @IsOptional() @Transform(trim) @IsString() @MaxLength(30) phone?: string;
  @IsOptional() @Transform(trim) @IsString() @MaxLength(60) nationality?: string;
}

export class PortalUploadDocumentDto {
  @IsString() @MinLength(1) @MaxLength(40) type!: string;
  @IsString() @MinLength(1) @MaxLength(120) label!: string;
}
