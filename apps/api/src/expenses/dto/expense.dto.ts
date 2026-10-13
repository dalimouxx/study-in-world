import { Transform } from 'class-transformer';
import { IsDateString, IsNumber, IsOptional, IsPositive, IsString, MaxLength, MinLength } from 'class-validator';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);

export class CreateExpenseDto {
  @Transform(trim) @IsString() @MinLength(1) @MaxLength(60) category!: string;
  @IsNumber() @IsPositive() amount!: number;
  @Transform(trim) @IsString() @MinLength(1) @MaxLength(300) description!: string;
  @IsOptional() @IsDateString() date?: string;
  @IsOptional() @IsString() branchId?: string;
  @IsOptional() @IsString() candidateId?: string;
}

export class ListExpensesQuery {
  @IsOptional() @IsDateString() from?: string;
  @IsOptional() @IsDateString() to?: string;
  @IsOptional() @IsString() branchId?: string;
  @IsOptional() @IsString() candidateId?: string;
}
