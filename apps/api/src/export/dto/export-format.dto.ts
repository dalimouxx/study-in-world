import { IsEnum, IsOptional } from 'class-validator';

export class ExportFormatQuery {
  @IsOptional() @IsEnum(['xlsx', 'pdf']) format: 'xlsx' | 'pdf' = 'xlsx';
}
