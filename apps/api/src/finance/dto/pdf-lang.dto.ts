import { IsIn, IsOptional } from 'class-validator';

/** `?lang=fr|ar` sur les routes PDF : remplace la langue préférée du candidat (ignoré pour un contrat). */
export class PdfLangQueryDto {
  @IsOptional() @IsIn(['fr', 'ar']) lang?: 'fr' | 'ar';
}
