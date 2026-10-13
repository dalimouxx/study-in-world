import { VisaStatus } from '@prisma/client';
import { Transform } from 'class-transformer';
import { IsDateString, IsEnum, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);

export class CreateVisaFileDto {
  @Transform(trim) @IsString() @MinLength(1) @MaxLength(80) country!: string;
  @IsOptional() @IsString() applicationId?: string;
  @IsOptional() @IsString() @MaxLength(2000) notes?: string;
}

export class UpdateVisaFileDto {
  @IsOptional() @IsEnum(VisaStatus) status?: VisaStatus;
  @IsOptional() @IsDateString() appointmentDate?: string;
  @IsOptional() @Transform(trim) @IsString() @MaxLength(120) visaCenter?: string;
  @IsOptional() @Transform(trim) @IsString() @MaxLength(80) referenceNumber?: string;
  @IsOptional() @IsDateString() submissionDate?: string;
  @IsOptional() @IsString() @MaxLength(2000) notes?: string;
}
