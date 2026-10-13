import { IsString, MaxLength, MinLength } from 'class-validator';

export class PortalLoginDto {
  @IsString() email!: string;
  @IsString() password!: string;
}

export class PortalRefreshDto {
  @IsString() refreshToken?: string;
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
