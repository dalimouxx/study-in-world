import { Controller, Get, Param, Query, Res } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { CurrentUser, RequirePermissions } from '../common/decorators';
import type { AuthUser } from '../common/auth-user';
import { ExportFormatQuery } from '../export/dto/export-format.dto';
import { ExportService } from '../export/export.service';
import { ForecastQuery } from './dto/forecast.dto';
import { ReportsService } from './reports.service';

@ApiTags('reports')
@ApiBearerAuth()
@Controller()
export class ReportsController {
  constructor(
    private readonly reports: ReportsService,
    private readonly exportSvc: ExportService,
  ) {}

  @Get('candidates/:candidateId/profitability') @RequirePermissions('finance.view')
  profitability(@CurrentUser() user: AuthUser, @Param('candidateId') candidateId: string) {
    return this.reports.candidateProfitability(user, candidateId);
  }

  @Get('reports/forecast') @RequirePermissions('finance.view')
  forecast(@CurrentUser() user: AuthUser, @Query() q: ForecastQuery) {
    return this.reports.forecast(user, q.period ?? '30d');
  }

  @Get('reports/forecast/export') @RequirePermissions('finance.view')
  async exportForecast(@CurrentUser() user: AuthUser, @Query() q: ForecastQuery, @Query() format: ExportFormatQuery, @Res() res: Response) {
    const f = await this.reports.forecast(user, q.period ?? '30d');
    const rows = [
      { label: 'Encaissé sur la période', value: f.collected },
      { label: 'Reste à encaisser', value: f.toCollect },
      { label: 'Dont en retard', value: f.overdue },
      { label: 'Dépenses sur la période', value: f.expenses },
      { label: 'Flux de trésorerie net', value: f.netCashFlow },
    ];
    const columns = [
      { header: 'Indicateur', value: (r: (typeof rows)[number]) => r.label },
      { header: 'Montant', value: (r: (typeof rows)[number]) => r.value.toFixed(3) },
    ];
    if (format.format === 'pdf') {
      const buffer = await this.exportSvc.toPdf('Prévisions financières — Study in World', columns, rows);
      res.set({ 'Content-Type': 'application/pdf', 'Content-Disposition': 'attachment; filename="previsions.pdf"' }).send(buffer);
    } else {
      const buffer = await this.exportSvc.toExcel('Prévisions', columns, rows);
      res.set({ 'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'Content-Disposition': 'attachment; filename="previsions.xlsx"' }).send(buffer);
    }
  }
}
