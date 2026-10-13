import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { UserStatus } from '@prisma/client';
import { Transform } from 'class-transformer';
import { IsEmail, IsEnum, IsIn, IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';
import { PaginationQuery } from '../../common/pagination';
import { PASSWORD_MESSAGE, PASSWORD_REGEX } from '../../auth/dto/auth.dto';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);

export class CreateEmployeeDto {
  @ApiProperty() @Transform(trim) @IsEmail() @MaxLength(254) email!: string;
  @ApiProperty() @Transform(trim) @IsString() @MinLength(1) @MaxLength(80) firstName!: string;
  @ApiProperty() @Transform(trim) @IsString() @MinLength(1) @MaxLength(80) lastName!: string;
  @ApiPropertyOptional() @IsOptional() @Transform(trim) @IsString() @MaxLength(30) phone?: string;
  @ApiProperty() @IsString() roleId!: string;
  @ApiPropertyOptional() @IsOptional() @IsString() branchId?: string;
  @ApiPropertyOptional({ enum: ['fr', 'ar'] }) @IsOptional() @IsIn(['fr', 'ar']) locale?: 'fr' | 'ar';
  @ApiProperty({ description: 'Mot de passe initial ; changement imposé à la première connexion' })
  @IsString() @Matches(PASSWORD_REGEX, { message: PASSWORD_MESSAGE }) password!: string;
}

export class UpdateEmployeeDto {
  @IsOptional() @Transform(trim) @IsString() @MinLength(1) @MaxLength(80) firstName?: string;
  @IsOptional() @Transform(trim) @IsString() @MinLength(1) @MaxLength(80) lastName?: string;
  @IsOptional() @Transform(trim) @IsString() @MaxLength(30) phone?: string;
  @IsOptional() @IsString() roleId?: string;
  @IsOptional() @IsString() branchId?: string | null;
  @IsOptional() @IsIn(['fr', 'ar']) locale?: 'fr' | 'ar';
  @IsOptional() @IsEnum(UserStatus) status?: UserStatus;
  @ApiPropertyOptional({ description: 'Réinitialisation du mot de passe par un administrateur' })
  @IsOptional() @IsString() @Matches(PASSWORD_REGEX, { message: PASSWORD_MESSAGE }) password?: string;
}

export class ListEmployeesQuery extends PaginationQuery {
  @IsOptional() @Transform(trim) @IsString() search?: string;
  @IsOptional() @IsString() roleId?: string;
  @IsOptional() @IsString() branchId?: string;
  @IsOptional() @IsEnum(UserStatus) status?: UserStatus;
}
