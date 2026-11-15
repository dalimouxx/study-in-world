import { IsString, MaxLength, MinLength, IsOptional } from 'class-validator';

export class PortalLoginDto {
  @IsString() email!: string;
  @IsString() password!: string;
}

export class PortalRefreshDto {
  // Optionnel : le navigateur envoie le token dans le cookie httpOnly (corps vide), l'application mobile dans le corps.
  @IsOptional() @IsString() refreshToken?: string;
}

export class PortalForgotPasswordDto {
  @IsString() email!: string;
}

export class PortalResetPasswordDto {
  @IsString() token!: string;
  @IsString() @MinLength(10) @MaxLength(200) newPassword!: string;
}

export class PortalActivateDto {
  @IsString() token!: string;
  @IsString() @MinLength(10) @MaxLength(200) newPassword!: string;
}
