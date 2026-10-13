import { CommissionType, PartnerType } from '@prisma/client';
import { Transform } from 'class-transformer';
import { IsBoolean, IsEnum, IsNumber, IsOptional, IsString, MaxLength, Min, MinLength } from 'class-validator';
import { PaginationQuery } from '../../common/pagination';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);

export class CreatePartnerDto {
  @IsEnum(PartnerType) type!: PartnerType;
  @Transform(trim) @IsString() @MinLength(1) @MaxLength(160) companyName!: string;
  @IsOptional() @Transform(trim) @IsString() @MaxLength(120) contactName?: string;
  @IsOptional() @Transform(trim) @IsString() @MaxLength(254) email?: string;
  @IsOptional() @Transform(trim) @IsString() @MaxLength(40) phone?: string;
  @IsOptional() @Transform(trim) @IsString() @MaxLength(80) country?: string;
  @IsOptional() @IsString() @MaxLength(2000) notes?: string;
  @IsOptional() @IsEnum(CommissionType) commissionType?: CommissionType;
  @IsOptional() @IsNumber() @Min(0) commissionValue?: number;
}

export class UpdatePartnerDto {
  @IsOptional() @IsEnum(PartnerType) type?: PartnerType;
  @IsOptional() @Transform(trim) @IsString() @MinLength(1) @MaxLength(160) companyName?: string;
  @IsOptional() @Transform(trim) @IsString() @MaxLength(120) contactName?: string;
  @IsOptional() @Transform(trim) @IsString() @MaxLength(254) email?: string;
  @IsOptional() @Transform(trim) @IsString() @MaxLength(40) phone?: string;
  @IsOptional() @Transform(trim) @IsString() @MaxLength(80) country?: string;
  @IsOptional() @IsString() @MaxLength(2000) notes?: string;
  @IsOptional() @IsEnum(CommissionType) commissionType?: CommissionType;
  @IsOptional() @IsNumber() @Min(0) commissionValue?: number;
  @IsOptional() @IsBoolean() isActive?: boolean;
}

export class ListPartnersQuery extends PaginationQuery {
  @IsOptional() @Transform(trim) @IsString() search?: string;
  @IsOptional() @IsEnum(PartnerType) type?: PartnerType;
  @IsOptional() includeInactive?: string;
}

export class CreateCommissionDto {
  @IsNumber() @Min(0) amount!: number;
  @IsOptional() @IsString() @MaxLength(8) currency?: string;
  @IsOptional() @IsString() @MaxLength(500) notes?: string;
}

export class UpdateCommissionStatusDto {
  @IsEnum(['TO_CONFIRM', 'EXPECTED', 'INVOICED', 'PARTIALLY_RECEIVED', 'RECEIVED', 'CANCELLED'] as const)
  status!: 'TO_CONFIRM' | 'EXPECTED' | 'INVOICED' | 'PARTIALLY_RECEIVED' | 'RECEIVED' | 'CANCELLED';
}

export class LinkCandidatePartnerDto {
  @IsOptional() @IsString() partnerId?: string;
}
