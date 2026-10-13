import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';

export const PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{10,128}$/;
export const PASSWORD_MESSAGE = '10 caractères minimum, avec majuscule, minuscule et chiffre';

export class LoginDto {
  @ApiProperty() @IsEmail() @MaxLength(254) email!: string;
  @ApiProperty() @IsString() @MinLength(1) @MaxLength(128) password!: string;
}

export class RefreshDto {
  @IsOptional() @IsString() refreshToken?: string;
}

export class ChangePasswordDto {
  @ApiProperty() @IsString() currentPassword!: string;
  @ApiProperty() @IsString() @Matches(PASSWORD_REGEX, { message: PASSWORD_MESSAGE }) newPassword!: string;
}

export class ForgotPasswordDto {
  @ApiProperty() @IsEmail() email!: string;
}

export class ResetPasswordDto {
  @ApiProperty() @IsString() @MinLength(20) token!: string;
  @ApiProperty() @IsString() @Matches(PASSWORD_REGEX, { message: PASSWORD_MESSAGE }) newPassword!: string;
}
