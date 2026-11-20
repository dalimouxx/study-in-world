import { Type } from 'class-transformer';
import { ArrayMinSize, IsArray, IsEnum, IsOptional, IsString, Min, MinLength, ValidateNested } from 'class-validator';

export class ContractItemDto {
  @IsString() @MinLength(1) label!: string;
  @Type(() => Number) quantity!: number;
  @Type(() => Number) @Min(0) unitPrice!: number;
}

export class CreateContractDto {
  /** Si fourni, les lignes du devis accepté sont reprises ; sinon `items` doit être fourni. */
  @IsOptional() @IsString() quoteId?: string;
  @IsOptional() @IsArray() @ArrayMinSize(1) @ValidateNested({ each: true }) @Type(() => ContractItemDto) items?: ContractItemDto[];
}

export class UpdateContractStatusDto {
  @IsEnum(['SENT', 'CANCELLED'] as const) status!: 'SENT' | 'CANCELLED';
}

export class SignContractDto {
  /** Image PNG du tracé, encodée en data URL (data:image/png;base64,...) ou en base64 brut. */
  @IsString() @MinLength(10) signatureImage!: string;
  @IsString() @MinLength(1) signerName!: string;
  @IsEnum(['DRAWN', 'TYPED'] as const) method!: 'DRAWN' | 'TYPED';
}
