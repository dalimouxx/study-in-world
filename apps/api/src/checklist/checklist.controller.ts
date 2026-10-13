import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Put } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser, ReqMeta, RequirePermissions } from '../common/decorators';
import type { AuthUser, RequestMeta } from '../common/auth-user';
import { ChecklistService } from './checklist.service';
import { CreateChecklistItemDto, ReorderChecklistDto, UpdateChecklistItemDto } from './dto/checklist.dto';

@ApiTags('checklist')
@ApiBearerAuth()
@Controller()
export class ChecklistController {
  constructor(private readonly checklist: ChecklistService) {}

  @Get('candidates/:candidateId/checklist') @RequirePermissions('candidate.view')
  list(@CurrentUser() user: AuthUser, @Param('candidateId') candidateId: string) {
    return this.checklist.list(user, candidateId);
  }

  @Post('candidates/:candidateId/checklist') @RequirePermissions('checklist.manage')
  create(@CurrentUser() user: AuthUser, @Param('candidateId') candidateId: string, @Body() dto: CreateChecklistItemDto) {
    return this.checklist.create(user, candidateId, dto);
  }

  @Put('candidates/:candidateId/checklist/reorder') @HttpCode(204) @RequirePermissions('checklist.manage')
  reorder(@CurrentUser() user: AuthUser, @Param('candidateId') candidateId: string, @Body() dto: ReorderChecklistDto) {
    return this.checklist.reorder(user, candidateId, dto);
  }

  @Patch('checklist/:id') @RequirePermissions('checklist.manage')
  update(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: UpdateChecklistItemDto, @ReqMeta() meta: RequestMeta) {
    return this.checklist.update(user, id, dto, meta);
  }

  @Delete('checklist/:id') @HttpCode(204) @RequirePermissions('checklist.manage')
  remove(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.checklist.remove(user, id);
  }

  @Get('visa-files/:visaFileId/checklist') @RequirePermissions('candidate.view')
  listForVisa(@CurrentUser() user: AuthUser, @Param('visaFileId') visaFileId: string) {
    return this.checklist.listForVisa(user.organizationId, visaFileId);
  }

  @Post('visa-files/:visaFileId/checklist') @RequirePermissions('visa.manage')
  createForVisa(@CurrentUser() user: AuthUser, @Param('visaFileId') visaFileId: string, @Body() dto: CreateChecklistItemDto) {
    return this.checklist.createForVisa(user, visaFileId, dto.label);
  }
}
