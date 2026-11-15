import { Transform } from 'class-transformer';
import { IsEmail, IsString, MaxLength, MinLength, IsOptional } from 'class-validator';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);

export class PartnerLoginDto {
  @IsString() email!: string;
  @IsString() password!: string;
}

export class PartnerRefreshDto {
  // Optionnel : le navigateur envoie le token dans le cookie httpOnly (corps vide), l'application mobile dans le corps.
  @IsOptional() @IsString() refreshToken?: string;
}

export class PartnerForgotPasswordDto {
  @IsString() email!: string;
}

export class PartnerResetPasswordDto {
  @IsString() token!: string;
  @IsString() @MinLength(10) @MaxLength(200) newPassword!: string;
}

export class PartnerActivateDto {
  @IsString() token!: string;
  @IsString() @MinLength(10) @MaxLength(200) newPassword!: string;
}

export class CreatePartnerUserDto {
  @Transform(trim) @IsEmail() @MaxLength(254) email!: string;
  @Transform(trim) @IsString() @MinLength(1) @MaxLength(80) firstName!: string;
  @Transform(trim) @IsString() @MinLength(1) @MaxLength(80) lastName!: string;
}
