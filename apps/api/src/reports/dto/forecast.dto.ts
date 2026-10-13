import { IsIn, IsOptional } from 'class-validator';

export class ForecastQuery {
  @IsOptional() @IsIn(['7d', '30d', '3m', '6m', '12m'] as const) period?: '7d' | '30d' | '3m' | '6m' | '12m';
}
