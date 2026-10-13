import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Query, Res } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';
import type { Response } from 'express';
import { CurrentUser, ReqMeta, RequirePermissions } from '../common/decorators';
import type { AuthUser, RequestMeta } from '../common/auth-user';
import { ExportFormatQuery } from '../export/dto/export-format.dto';
import { ExportService } from '../export/export.service';
import { AddNoteDto, CreateCandidateDto, ListCandidatesQuery, UpdateCandidateDto } from './dto/candidate.dto';
import { CandidatesService } from './candidates.service';

class TimelineQuery {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page = 1;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) pageSize = 20;
}

@ApiTags('candidates')
@ApiBearerAuth()
@Controller('candidates')
export class CandidatesController {
  constructor(
    private readonly candidates: CandidatesService,
    private readonly exportSvc: ExportService,
  ) {}

  @Get() @RequirePermissions('candidate.view')
  list(@CurrentUser() user: AuthUser, @Query() q: ListCandidatesQuery) {
    return this.candidates.list(user, q);
  }

  @Get('export') @RequirePermissions('candidate.view')
  async export(@CurrentUser() user: AuthUser, @Query() q: ListCandidatesQuery, @Query() format: ExportFormatQuery, @Res() res: Response) {
    const rows = await this.candidates.listForExport(user, q);
    const columns = [
      { header: 'Prénom', value: (r: (typeof rows)[number]) => r.firstName },
      { header: 'Nom', value: (r: (typeof rows)[number]) => r.lastName },
      { header: 'Téléphone', value: (r: (typeof rows)[number]) => r.phone },
      { header: 'E-mail', value: (r: (typeof rows)[number]) => r.email ?? '' },
      { header: 'Statut', value: (r: (typeof rows)[number]) => r.status },
      { header: 'Nationalité', value: (r: (typeof rows)[number]) => r.nationality ?? '' },
      { header: 'Passeport', value: (r: (typeof rows)[number]) => r.passportNumber ?? '' },
      { header: 'Conseiller', value: (r: (typeof rows)[number]) => (r.assignedTo ? `${r.assignedTo.firstName} ${r.assignedTo.lastName}` : '') },
    ];
    if (format.format === 'pdf') {
      const buffer = await this.exportSvc.toPdf('Candidats — Study in World', columns, rows);
      res.set({ 'Content-Type': 'application/pdf', 'Content-Disposition': 'attachment; filename="candidats.pdf"' }).send(buffer);
    } else {
      const buffer = await this.exportSvc.toExcel('Candidats', columns, rows);
      res.set({ 'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'Content-Disposition': 'attachment; filename="candidats.xlsx"' }).send(buffer);
    }
  }

  @Get(':id') @RequirePermissions('candidate.view')
  get(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.candidates.get(user, id);
  }

  @Get(':id/timeline') @RequirePermissions('candidate.view')
  timeline(@CurrentUser() user: AuthUser, @Param('id') id: string, @Query() q: TimelineQuery) {
    return this.candidates.timelineFor(user, id, q.page, q.pageSize);
  }

  @Post() @RequirePermissions('candidate.manage')
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateCandidateDto, @ReqMeta() meta: RequestMeta) {
    return this.candidates.create(user, dto, meta);
  }

  @Post(':id/notes') @RequirePermissions('candidate.manage')
  addNote(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: AddNoteDto) {
    return this.candidates.addNote(user, id, dto);
  }

  @Patch(':id') @RequirePermissions('candidate.manage')
  update(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: UpdateCandidateDto, @ReqMeta() meta: RequestMeta) {
    return this.candidates.update(user, id, dto, meta);
  }

  @Delete(':id') @HttpCode(204) @RequirePermissions('candidate.manage')
  remove(@CurrentUser() user: AuthUser, @Param('id') id: string, @ReqMeta() meta: RequestMeta) {
    return this.candidates.remove(user, id, meta);
  }
}
