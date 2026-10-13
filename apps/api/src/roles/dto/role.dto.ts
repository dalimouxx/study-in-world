import { IsArray, IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';

export class CreateRoleDto {
  @IsString() @MinLength(2) @MaxLength(60) name!: string;
  @IsOptional() @IsString() @MaxLength(200) description?: string;
  @IsOptional() @IsArray() @IsString({ each: true }) permissions?: string[];
}

export class SetPermissionsDto {
  @IsArray() @IsString({ each: true }) @Matches(/^[a-z_]+\.[a-z_]+$/, { each: true }) permissions!: string[];
}
