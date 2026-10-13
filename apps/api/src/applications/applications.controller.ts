import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser, ReqMeta, RequirePermissions } from '../common/decorators';
import type { AuthUser, RequestMeta } from '../common/auth-user';
import { ApplicationsService } from './applications.service';
import { CreateApplicationDto, UpdateApplicationDto } from './dto/application.dto';

@ApiTags('applications')
@ApiBearerAuth()
@Controller()
export class ApplicationsController {
  constructor(private readonly applications: ApplicationsService) {}

  @Get('candidates/:candidateId/applications') @RequirePermissions('candidate.view')
  list(@CurrentUser() user: AuthUser, @Param('candidateId') candidateId: string) {
    return this.applications.list(user, candidateId);
  }

  @Post('candidates/:candidateId/applications') @RequirePermissions('application.manage')
  create(@CurrentUser() user: AuthUser, @Param('candidateId') candidateId: string, @Body() dto: CreateApplicationDto, @ReqMeta() meta: RequestMeta) {
    return this.applications.create(user, candidateId, dto, meta);
  }

  @Patch('applications/:id') @RequirePermissions('application.manage')
  update(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: UpdateApplicationDto, @ReqMeta() meta: RequestMeta) {
    return this.applications.update(user, id, dto, meta);
  }

  @Delete('applications/:id') @HttpCode(204) @RequirePermissions('application.manage')
  remove(@CurrentUser() user: AuthUser, @Param('id') id: string, @ReqMeta() meta: RequestMeta) {
    return this.applications.remove(user, id, meta);
  }
}
