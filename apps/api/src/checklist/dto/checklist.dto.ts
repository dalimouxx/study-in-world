import { ChecklistItemStatus } from '@prisma/client';
import { IsArray, IsEnum, IsInt, IsOptional, IsString, MaxLength, MinLength, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateChecklistItemDto {
  @IsString() @MinLength(1) @MaxLength(160) label!: string;
}

export class UpdateChecklistItemDto {
  @IsOptional() @IsString() @MinLength(1) @MaxLength(160) label?: string;
  @IsOptional() @IsEnum(ChecklistItemStatus) status?: ChecklistItemStatus;
  @IsOptional() @IsString() @MaxLength(500) note?: string;
}

class ReorderEntry {
  @IsString() id!: string;
  @IsInt() position!: number;
}

export class ReorderChecklistDto {
  @IsArray() @ValidateNested({ each: true }) @Type(() => ReorderEntry) items!: ReorderEntry[];
}
