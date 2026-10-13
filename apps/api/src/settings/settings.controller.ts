import { Body, Controller, Get, NotFoundException, Patch } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser, Public, ReqMeta, RequirePermissions } from '../common/decorators';
import type { AuthUser, RequestMeta } from '../common/auth-user';
import type { Env } from '../config/env';
import { UpdateAgencySettingsDto } from './dto/agency-settings.dto';
import { SettingsService } from './settings.service';

@ApiTags('settings')
@Controller()
export class SettingsController {
  constructor(
    private readonly settings: SettingsService,
    private readonly config: ConfigService<Env, true>,
  ) {}

  @ApiBearerAuth()
  @Get('settings/agency') @RequirePermissions('settings.view')
  get(@CurrentUser() user: AuthUser) {
    return this.settings.getAgency(user.organizationId);
  }

  @ApiBearerAuth()
  @Patch('settings/agency') @RequirePermissions('settings.manage')
  update(@CurrentUser() user: AuthUser, @Body() dto: UpdateAgencySettingsDto, @ReqMeta() meta: RequestMeta) {
    return this.settings.updateAgency(user, dto, meta);
  }

  @Public()
  @Get('public/agency')
  async publicAgency() {
    const data = await this.settings.getPublicAgency(this.config.get('DEFAULT_ORG_SLUG', { infer: true }));
    if (!data) throw new NotFoundException();
    return data;
  }
}
