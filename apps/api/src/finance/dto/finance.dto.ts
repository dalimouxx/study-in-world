import { Type } from 'class-transformer';
import { ArrayMinSize, IsArray, IsDateString, IsEnum, IsNumber, IsOptional, IsPositive, IsString, Min, MinLength, ValidateNested } from 'class-validator';
import { PaymentMethod } from '@prisma/client';

export class ItemDto {
  @IsString() @MinLength(1) label!: string;
  @IsNumber() @Min(1) quantity!: number;
  @IsNumber() @Min(0) unitPrice!: number;
}

export class CreateQuoteDto {
  @IsOptional() @IsString() currency?: string;
  @IsOptional() @IsDateString() validUntil?: string;
  @IsOptional() @IsString() notes?: string;
  @IsArray() @ArrayMinSize(1) @ValidateNested({ each: true }) @Type(() => ItemDto) items!: ItemDto[];
}

export class UpdateQuoteStatusDto {
  @IsEnum(['SENT', 'ACCEPTED', 'REJECTED', 'EXPIRED'] as const) status!: 'SENT' | 'ACCEPTED' | 'REJECTED' | 'EXPIRED';
}

export class CreateInvoiceDto {
  @IsOptional() @IsString() currency?: string;
  @IsOptional() @IsDateString() dueDate?: string;
  @IsOptional() @IsString() notes?: string;
  @IsArray() @ArrayMinSize(1) @ValidateNested({ each: true }) @Type(() => ItemDto) items!: ItemDto[];
}

export class RecordPaymentDto {
  @IsNumber() @IsPositive() amount!: number;
  @IsEnum(PaymentMethod) method!: PaymentMethod;
  @IsOptional() @IsDateString() paidAt?: string;
}
