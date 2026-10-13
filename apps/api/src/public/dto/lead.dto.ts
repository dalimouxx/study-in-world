import { Transform } from 'class-transformer';
import { IsEmail, IsNumber, IsOptional, IsString, MaxLength, Min, MinLength } from 'class-validator';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);

export class CreateLeadDto {
  @Transform(trim) @IsString() @MinLength(1) @MaxLength(80) firstName!: string;
  @Transform(trim) @IsString() @MinLength(1) @MaxLength(80) lastName!: string;
  @Transform(trim) @IsString() @MinLength(4) @MaxLength(30) phone!: string;
  @IsOptional() @Transform(trim) @IsEmail() @MaxLength(254) email?: string;
  @IsOptional() @Transform(trim) @IsString() @MaxLength(2000) message?: string;
  // Renseignés lorsque le lead vient du simulateur d'éligibilité (section 71) — jamais requis pour le formulaire de contact simple.
  @IsOptional() @IsString() desiredCountryId?: string;
  @IsOptional() @Transform(trim) @IsString() @MaxLength(160) desiredProgram?: string;
  @IsOptional() @IsNumber() @Min(0) budget?: number;
  @IsOptional() @Transform(trim) @IsString() @MaxLength(120) campaign?: string;
}
