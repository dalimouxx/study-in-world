import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser, ReqMeta, RequirePermissions } from '../common/decorators';
import type { AuthUser, RequestMeta } from '../common/auth-user';
import { CreateProgramDto, SearchProgramsQuery, UpdateProgramDto } from './dto/program.dto';
import { ProgramsService } from './programs.service';

@ApiTags('catalog')
@ApiBearerAuth()
@Controller('programs')
export class ProgramsController {
  constructor(private readonly programs: ProgramsService) {}

  @Get() @RequirePermissions('catalog.view')
  list(@CurrentUser() user: AuthUser, @Query() q: SearchProgramsQuery) {
    return this.programs.search(user.organizationId, q);
  }

  @Get('compare') @RequirePermissions('catalog.view')
  compare(@CurrentUser() user: AuthUser, @Query('ids') ids: string) {
    return this.programs.compare(user.organizationId, (ids ?? '').split(',').filter(Boolean));
  }

  @Get(':id') @RequirePermissions('catalog.view')
  get(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.programs.get(user, id);
  }

  @Post() @RequirePermissions('catalog.manage')
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateProgramDto, @ReqMeta() meta: RequestMeta) {
    return this.programs.create(user, dto, meta);
  }

  @Patch(':id') @RequirePermissions('catalog.manage')
  update(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: UpdateProgramDto, @ReqMeta() meta: RequestMeta) {
    return this.programs.update(user, id, dto, meta);
  }

  @Delete(':id') @HttpCode(204) @RequirePermissions('catalog.manage')
  remove(@CurrentUser() user: AuthUser, @Param('id') id: string, @ReqMeta() meta: RequestMeta) {
    return this.programs.remove(user, id, meta);
  }
}
