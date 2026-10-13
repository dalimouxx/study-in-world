import { Type } from 'class-transformer';
import { IsEmail, IsIn, IsOptional, IsString, IsUrl, MaxLength, MinLength, ValidateIf, ValidateNested } from 'class-validator';

const url = { require_protocol: true, protocols: ['http', 'https'] };
const notEmpty = (_: unknown, v: unknown) => v !== '';

export class SocialLinksDto {
  @IsOptional() @ValidateIf(notEmpty) @IsUrl(url) facebook?: string;
  @IsOptional() @ValidateIf(notEmpty) @IsUrl(url) instagram?: string;
  @IsOptional() @ValidateIf(notEmpty) @IsUrl(url) tiktok?: string;
  @IsOptional() @ValidateIf(notEmpty) @IsUrl(url) linkedin?: string;
  @IsOptional() @ValidateIf(notEmpty) @IsUrl(url) youtube?: string;
}

/** Champs vides (« ») acceptés : ils effacent la valeur. */
export class UpdateAgencySettingsDto {
  @IsOptional() @IsString() @MinLength(2) @MaxLength(120) name?: string;
  @IsOptional() @IsString() @MaxLength(500) logoUrl?: string;
  @IsOptional() @IsString() @MaxLength(500) logoDarkUrl?: string;
  @IsOptional() @IsString() @MaxLength(500) faviconUrl?: string;
  @IsOptional() @IsString() @MaxLength(300) address?: string;
  @IsOptional() @IsString() @MaxLength(30) phone?: string;
  @IsOptional() @IsString() @MaxLength(30) whatsapp?: string;
  @IsOptional() @ValidateIf(notEmpty) @IsEmail() email?: string;
  @IsOptional() @IsString() @MaxLength(200) website?: string;
  @IsOptional() @ValidateNested() @Type(() => SocialLinksDto) socialLinks?: SocialLinksDto;
  @IsOptional() @IsString() @MaxLength(500) openingHours?: string;
  @IsOptional() @IsString() @MaxLength(2000) legalInfo?: string;
  @IsOptional() @IsString() @MaxLength(60) taxId?: string;
  @IsOptional() @IsString() @MaxLength(1000) bankDetails?: string;
  @IsOptional() @IsIn(['TND', 'EUR', 'USD']) currency?: string;
  @IsOptional() @IsString() @MaxLength(60) timezone?: string;
  @IsOptional() @IsString() @MaxLength(500) footerText?: string;
  @IsOptional() @IsString() @MaxLength(20000) privacyPolicy?: string;
  @IsOptional() @IsString() @MaxLength(20000) termsOfService?: string;
  @IsOptional() @IsString() @MaxLength(20000) legalNotice?: string;
}
