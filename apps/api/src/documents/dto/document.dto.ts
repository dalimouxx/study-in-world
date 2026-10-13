import { DocumentStatus } from '@prisma/client';
import { IsDateString, IsEnum, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class UploadDocumentDto {
  @IsString() @MinLength(1) @MaxLength(40) type!: string;
  @IsString() @MinLength(1) @MaxLength(120) label!: string;
  @IsOptional() @IsDateString() expiryDate?: string;
}

export class ReviewDocumentDto {
  @IsEnum(DocumentStatus) status!: DocumentStatus;
  @IsOptional() @IsString() @MaxLength(500) reviewNote?: string;
  @IsOptional() @IsDateString() expiryDate?: string;
}
