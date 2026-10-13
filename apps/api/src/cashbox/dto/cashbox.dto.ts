import { Transform } from 'class-transformer';
import { IsNumber, IsOptional, IsPositive, IsString, MaxLength, Min } from 'class-validator';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);

export class OpenCashboxDto {
  @IsOptional() @IsString() branchId?: string;
  @IsNumber() @Min(0) openingAmount!: number;
  @IsOptional() @Transform(trim) @IsString() @MaxLength(500) note?: string;
}

export class CloseCashboxDto {
  @IsNumber() @Min(0) closingAmount!: number;
  @IsOptional() @Transform(trim) @IsString() @MaxLength(500) note?: string;
}

export class CreateMovementDto {
  @IsNumber() @IsPositive() amount!: number;
  @Transform(trim) @IsString() @MaxLength(300) reason!: string;
}
