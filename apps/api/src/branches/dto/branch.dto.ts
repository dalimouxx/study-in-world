import { PartialType } from '@nestjs/swagger';
import { IsBoolean, IsEmail, IsOptional, IsString, Matches, MaxLength, MinLength, ValidateIf } from 'class-validator';

export class CreateBranchDto {
  @IsString() @MinLength(2) @MaxLength(100) name!: string;
  @IsString() @Matches(/^[A-Z0-9]{2,10}$/, { message: 'Code : 2 à 10 lettres majuscules ou chiffres' }) code!: string;
  @IsOptional() @IsString() @MaxLength(80) city?: string;
  @IsOptional() @IsString() @MaxLength(250) address?: string;
  @IsOptional() @IsString() @MaxLength(30) phone?: string;
  @IsOptional() @ValidateIf((_, v) => v !== '') @IsEmail() email?: string;
  @IsOptional() @IsBoolean() isActive?: boolean;
}

export class UpdateBranchDto extends PartialType(CreateBranchDto) {}
