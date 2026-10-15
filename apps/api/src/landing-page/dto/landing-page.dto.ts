import { Type } from 'class-transformer';
import { ArrayMinSize, IsArray, IsBoolean, IsIn, IsInt, IsOptional, IsString, MaxLength, MinLength, ValidateIf, ValidateNested } from 'class-validator';

/**
 * Icônes disponibles pour une carte « service » de la landing page : liste fermée, jamais un SVG ou un
 * nom de classe arbitraire importé par le Super Admin — on ne rend que ces noms, mappés côté front vers
 * les icônes lucide-react déjà utilisées sur le site public.
 */
export const LANDING_SERVICE_ICONS = [
  'GraduationCap', 'Briefcase', 'Languages', 'Users', 'FileText', 'ShieldCheck', 'Sparkles', 'Plane', 'Home', 'Heart',
] as const;
export type LandingServiceIcon = (typeof LANDING_SERVICE_ICONS)[number];

const notEmpty = (_: unknown, v: unknown) => v !== '';

/** Contenu Hero / À propos / SEO. Champ vide (« ») accepté : il efface la valeur. */
export class UpdateLandingContentDto {
  @IsOptional() @IsString() @MaxLength(200) heroTitleFr?: string;
  @IsOptional() @IsString() @MaxLength(300) heroSubtitleFr?: string;
  @IsOptional() @IsString() @MaxLength(500) heroImageUrl?: string;
  @IsOptional() @IsString() @MaxLength(200) aboutTitleFr?: string;
  @IsOptional() @IsString() @MaxLength(4000) aboutTextFr?: string;
  @IsOptional() @IsString() @MaxLength(500) aboutImageUrl?: string;
  @IsOptional() @IsString() @MaxLength(70) seoTitleFr?: string;
  @IsOptional() @IsString() @MaxLength(200) seoDescriptionFr?: string;
}

/** Logos de l'agence + favicon + texte de pied de page — déplacés ici depuis les paramètres généraux : réservés au Super Admin. */
export class UpdateLandingBrandingDto {
  @IsOptional() @IsString() @MaxLength(500) logoUrl?: string;
  @IsOptional() @IsString() @MaxLength(500) logoDarkUrl?: string;
  @IsOptional() @IsString() @MaxLength(500) faviconUrl?: string;
  @IsOptional() @IsString() @MaxLength(500) footerTextFr?: string;
}

export class CreateLandingServiceDto {
  @IsString() @MinLength(2) @MaxLength(120) titleFr!: string;
  @IsString() @MinLength(2) @MaxLength(400) descriptionFr!: string;
  @IsIn(LANDING_SERVICE_ICONS) iconName!: LandingServiceIcon;
}

export class UpdateLandingServiceDto {
  @IsOptional() @IsString() @MinLength(2) @MaxLength(120) titleFr?: string;
  @IsOptional() @IsString() @MinLength(2) @MaxLength(400) descriptionFr?: string;
  @IsOptional() @IsIn(LANDING_SERVICE_ICONS) iconName?: LandingServiceIcon;
  @IsOptional() @IsBoolean() isActive?: boolean;
}

export class CreateLandingFaqItemDto {
  @IsString() @MinLength(2) @MaxLength(200) questionFr!: string;
  @IsString() @MinLength(2) @MaxLength(2000) answerFr!: string;
}

export class UpdateLandingFaqItemDto {
  @IsOptional() @IsString() @MinLength(2) @MaxLength(200) questionFr?: string;
  @IsOptional() @IsString() @MinLength(2) @MaxLength(2000) answerFr?: string;
  @IsOptional() @IsBoolean() isActive?: boolean;
}

export class CreateTestimonialDto {
  @IsString() @MinLength(2) @MaxLength(120) name!: string;
  @IsOptional() @ValidateIf(notEmpty) @IsString() @MaxLength(120) destination?: string;
  @IsString() @MinLength(2) @MaxLength(1000) quoteFr!: string;
}

export class UpdateTestimonialDto {
  @IsOptional() @IsString() @MinLength(2) @MaxLength(120) name?: string;
  @IsOptional() @IsString() @MaxLength(120) destination?: string;
  @IsOptional() @IsString() @MinLength(2) @MaxLength(1000) quoteFr?: string;
  @IsOptional() @IsBoolean() isActive?: boolean;
}

export class CreatePartnerLogoDto {
  @IsString() @MinLength(2) @MaxLength(120) name!: string;
  @IsString() @MaxLength(500) logoUrl!: string;
}

export class UpdatePartnerLogoDto {
  @IsOptional() @IsString() @MinLength(2) @MaxLength(120) name?: string;
  @IsOptional() @IsString() @MaxLength(500) logoUrl?: string;
  @IsOptional() @IsBoolean() isActive?: boolean;
}

class ReorderItemDto {
  @IsString() id!: string;
  @IsInt() position!: number;
}

export class ReorderDto {
  @IsArray() @ArrayMinSize(1) @ValidateNested({ each: true }) @Type(() => ReorderItemDto) items!: ReorderItemDto[];
}
