import { Type } from 'class-transformer';
import { IsEmail, IsIn, IsOptional, IsString, IsUrl, MaxLength, MinLength, ValidateIf, ValidateNested, IsTimeZone, IsBoolean, IsNumber, Max, Min } from 'class-validator';

const url = { require_protocol: true, protocols: ['http', 'https'] };
const notEmpty = (_: unknown, v: unknown) => v !== '';

export class SocialLinksDto {
  @IsOptional() @ValidateIf(notEmpty) @IsUrl(url) facebook?: string;
  @IsOptional() @ValidateIf(notEmpty) @IsUrl(url) instagram?: string;
  @IsOptional() @ValidateIf(notEmpty) @IsUrl(url) tiktok?: string;
  @IsOptional() @ValidateIf(notEmpty) @IsUrl(url) linkedin?: string;
  @IsOptional() @ValidateIf(notEmpty) @IsUrl(url) youtube?: string;
}

/**
 * Champs vides (« ») acceptés : ils effacent la valeur.
 *
 * logoUrl, logoDarkUrl, faviconUrl et footerText ne sont volontairement PAS dans ce DTO : ils ont été
 * déplacés vers PATCH /landing-page/branding (réservé au Super Admin, voir LandingPageService et
 * SuperAdminGuard) — ces champs sont du contenu de la landing page publique, pas des paramètres
 * d'exploitation courants que le rôle Administrateur doit pouvoir modifier.
 */
export class UpdateAgencySettingsDto {
  @IsOptional() @IsString() @MinLength(2) @MaxLength(120) name?: string;
  @IsOptional() @IsString() @MaxLength(300) address?: string;
  /** Nom et adresse en arabe, utilisés sur les documents arabes s'ils sont remplis. */
  @IsOptional() @IsString() @MaxLength(120) nameAr?: string;
  @IsOptional() @IsString() @MaxLength(300) addressAr?: string;
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
  /** Fuseau IANA (ex. Africa/Tunis) : sert aux dates « aujourd'hui / demain » et à l'heure de la tournée des relances. */
  @IsOptional() @IsString() @MaxLength(60) @IsTimeZone() timezone?: string;
  @IsOptional() @IsString() @MaxLength(20000) privacyPolicy?: string;
  @IsOptional() @IsString() @MaxLength(20000) termsOfService?: string;
  @IsOptional() @IsString() @MaxLength(20000) legalNotice?: string;
  /** Modèles de contrat (français et arabe), avec les espaces réservés {{…}}. */
  @IsOptional() @IsString() @MaxLength(20000) contractTemplate?: string;
  @IsOptional() @IsString() @MaxLength(20000) contractTemplateAr?: string;
  /** Facturation : appliquer la TVA et le timbre fiscal aux nouveaux devis et factures ; taux en %, timbre en TND. */
  // Absents : inchangés ; mais jamais vides (null) : ces colonnes sont obligatoires en base (sinon erreur 500).
  @ValidateIf((_, v) => v !== undefined) @IsBoolean() taxesEnabled?: boolean;
  @ValidateIf((_, v) => v !== undefined) @IsNumber() @Min(0) @Max(100) vatRate?: number;
  @ValidateIf((_, v) => v !== undefined) @IsNumber() @Min(0) @Max(1000) stampDuty?: number;
}
