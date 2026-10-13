import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Query, Res } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { IsInt, IsOptional, Max, Min } from 'class-validator';
import { Type } from 'class-transformer';
import type { Response } from 'express';
import { CurrentUser, ReqMeta, RequirePermissions } from '../common/decorators';
import type { AuthUser, RequestMeta } from '../common/auth-user';
import { ExportFormatQuery } from '../export/dto/export-format.dto';
import { ExportService } from '../export/export.service';
import { AddNoteDto, CreateProspectDto, ListProspectsQuery, UpdateProspectDto } from './dto/prospect.dto';
import { ProspectsService } from './prospects.service';

class TimelineQuery {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page = 1;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) pageSize = 20;
}

class DuplicateQuery {
  phone!: string;
}

@ApiTags('prospects')
@ApiBearerAuth()
@Controller('prospects')
export class ProspectsController {
  constructor(
    private readonly prospects: ProspectsService,
    private readonly exportSvc: ExportService,
  ) {}

  @Get() @RequirePermissions('prospect.view')
  list(@CurrentUser() user: AuthUser, @Query() q: ListProspectsQuery) {
    return this.prospects.list(user, q);
  }

  @Get('duplicates') @RequirePermissions('prospect.view')
  duplicates(@CurrentUser() user: AuthUser, @Query() q: DuplicateQuery) {
    return this.prospects.findDuplicates(user, q.phone ?? '');
  }

  @Get('board') @RequirePermissions('prospect.view')
  board(@CurrentUser() user: AuthUser) {
    return this.prospects.board(user);
  }

  @Get('export') @RequirePermissions('prospect.view')
  async export(@CurrentUser() user: AuthUser, @Query() q: ListProspectsQuery, @Query() format: ExportFormatQuery, @Res() res: Response) {
    const rows = await this.prospects.listForExport(user, q);
    const columns = [
      { header: 'Prénom', value: (r: (typeof rows)[number]) => r.firstName },
      { header: 'Nom', value: (r: (typeof rows)[number]) => r.lastName },
      { header: 'Téléphone', value: (r: (typeof rows)[number]) => r.phone },
      { header: 'E-mail', value: (r: (typeof rows)[number]) => r.email ?? '' },
      { header: 'Statut', value: (r: (typeof rows)[number]) => r.status },
      { header: 'Source', value: (r: (typeof rows)[number]) => r.source },
      { header: 'Score', value: (r: (typeof rows)[number]) => r.score },
      { header: 'Conseiller', value: (r: (typeof rows)[number]) => (r.assignedTo ? `${r.assignedTo.firstName} ${r.assignedTo.lastName}` : '') },
    ];
    if (format.format === 'pdf') {
      const buffer = await this.exportSvc.toPdf('Prospects — Study in World', columns, rows);
      res.set({ 'Content-Type': 'application/pdf', 'Content-Disposition': 'attachment; filename="prospects.pdf"' }).send(buffer);
    } else {
      const buffer = await this.exportSvc.toExcel('Prospects', columns, rows);
      res.set({ 'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'Content-Disposition': 'attachment; filename="prospects.xlsx"' }).send(buffer);
    }
  }

  @Get(':id') @RequirePermissions('prospect.view')
  get(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.prospects.get(user, id);
  }

  @Get(':id/timeline') @RequirePermissions('prospect.view')
  timeline(@CurrentUser() user: AuthUser, @Param('id') id: string, @Query() q: TimelineQuery) {
    return this.prospects.timelineFor(user, id, q.page, q.pageSize);
  }

  @Post() @RequirePermissions('prospect.manage')
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateProspectDto, @ReqMeta() meta: RequestMeta) {
    return this.prospects.create(user, dto, meta);
  }

  @Post(':id/notes') @RequirePermissions('prospect.manage')
  addNote(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: AddNoteDto) {
    return this.prospects.addNote(user, id, dto);
  }

  @Post(':id/convert') @RequirePermissions('prospect.manage')
  convert(@CurrentUser() user: AuthUser, @Param('id') id: string, @ReqMeta() meta: RequestMeta) {
    return this.prospects.convert(user, id, meta);
  }

  @Patch(':id') @RequirePermissions('prospect.manage')
  update(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: UpdateProspectDto, @ReqMeta() meta: RequestMeta) {
    return this.prospects.update(user, id, dto, meta);
  }

  @Delete(':id') @HttpCode(204) @RequirePermissions('prospect.manage')
  remove(@CurrentUser() user: AuthUser, @Param('id') id: string, @ReqMeta() meta: RequestMeta) {
    return this.prospects.remove(user, id, meta);
  }
}
