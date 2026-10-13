import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser, ReqMeta, RequirePermissions } from '../common/decorators';
import type { AuthUser, RequestMeta } from '../common/auth-user';
import { AutomationRulesService } from './automation-rules.service';
import { CreateAutomationRuleDto, UpdateAutomationRuleDto } from './dto/automation.dto';

@ApiTags('automation')
@ApiBearerAuth()
@Controller()
export class AutomationController {
  constructor(private readonly rules: AutomationRulesService) {}

  @Get('automation-rules') @RequirePermissions('automation.view')
  list(@CurrentUser() user: AuthUser) {
    return this.rules.list(user);
  }

  @Get('automation-rules/:id') @RequirePermissions('automation.view')
  get(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.rules.get(user, id);
  }

  @Post('automation-rules') @RequirePermissions('automation.manage')
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateAutomationRuleDto, @ReqMeta() meta: RequestMeta) {
    return this.rules.create(user, dto, meta);
  }

  @Patch('automation-rules/:id') @RequirePermissions('automation.manage')
  update(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: UpdateAutomationRuleDto, @ReqMeta() meta: RequestMeta) {
    return this.rules.update(user, id, dto, meta);
  }

  @Delete('automation-rules/:id') @HttpCode(204) @RequirePermissions('automation.manage')
  remove(@CurrentUser() user: AuthUser, @Param('id') id: string, @ReqMeta() meta: RequestMeta) {
    return this.rules.remove(user, id, meta);
  }

  @Get('candidates/:candidateId/automation-executions') @RequirePermissions('candidate.view')
  executions(@CurrentUser() user: AuthUser, @Param('candidateId') candidateId: string) {
    return this.rules.executionsFor(user, candidateId);
  }
}
