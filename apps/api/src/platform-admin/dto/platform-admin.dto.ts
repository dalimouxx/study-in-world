import { Transform } from 'class-transformer';
import { IsBoolean, IsDateString, IsEmail, IsEnum, IsNumber, IsOptional, IsString, Matches, MaxLength, Min, MinLength } from 'class-validator';
import { OrganizationPlan, PlatformInvoiceStatus, SubscriptionStatus } from '@prisma/client';
import { PASSWORD_MESSAGE, PASSWORD_REGEX } from '../../auth/dto/auth.dto';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);
const slugify = (s: string) =>
  s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

export class CreateOrganizationDto {
  @Transform(trim) @IsString() @MinLength(2) @MaxLength(120) name!: string;
  @IsOptional() @Transform(({ value }) => (typeof value === 'string' ? slugify(value) : value)) @IsString() slug?: string;
  @Transform(trim) @IsEmail() @MaxLength(254) adminEmail!: string;
  @Transform(trim) @IsString() @MinLength(1) @MaxLength(80) adminFirstName!: string;
  @Transform(trim) @IsString() @MinLength(1) @MaxLength(80) adminLastName!: string;
  @IsString() @Matches(PASSWORD_REGEX, { message: PASSWORD_MESSAGE }) adminPassword!: string;
  @IsOptional() @IsEnum(OrganizationPlan) plan?: OrganizationPlan;
}

export class UpdateOrganizationDto {
  @IsOptional() @Transform(trim) @IsString() @MinLength(2) @MaxLength(120) name?: string;
  @IsOptional() @IsEnum(OrganizationPlan) plan?: OrganizationPlan;
  @IsOptional() @IsEnum(SubscriptionStatus) subscriptionStatus?: SubscriptionStatus;
  @IsOptional() @IsBoolean() isActive?: boolean;
}

export { slugify };

export class CreatePlatformInvoiceDto {
  @IsNumber() @Min(0) amount!: number;
  @IsOptional() @IsString() currency?: string;
  @IsDateString() periodStart!: string;
  @IsDateString() periodEnd!: string;
  @IsDateString() dueDate!: string;
  @IsOptional() @Transform(trim) @IsString() @MaxLength(500) notes?: string;
}

export class UpdatePlatformInvoiceDto {
  @IsOptional() @IsEnum(PlatformInvoiceStatus) status?: PlatformInvoiceStatus;
  @IsOptional() @Transform(trim) @IsString() @MaxLength(500) notes?: string;
}
