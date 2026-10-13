import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser, ReqMeta, RequirePermissions } from '../common/decorators';
import type { AuthUser, RequestMeta } from '../common/auth-user';
import { CreatePartnerDto, ListPartnersQuery, UpdatePartnerDto } from './dto/partner.dto';
import { PartnersService } from './partners.service';

@ApiTags('partners')
@ApiBearerAuth()
@Controller('partners')
export class PartnersController {
  constructor(private readonly partners: PartnersService) {}

  @Get() @RequirePermissions('partner.view')
  list(@CurrentUser() user: AuthUser, @Query() q: ListPartnersQuery) {
    return this.partners.list(user, q);
  }

  @Get(':id') @RequirePermissions('partner.view')
  get(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.partners.get(user, id);
  }

  @Get(':id/candidates') @RequirePermissions('partner.view')
  candidates(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.partners.candidates(user, id);
  }

  @Post() @RequirePermissions('partner.manage')
  create(@CurrentUser() user: AuthUser, @Body() dto: CreatePartnerDto, @ReqMeta() meta: RequestMeta) {
    return this.partners.create(user, dto, meta);
  }

  @Patch(':id') @RequirePermissions('partner.manage')
  update(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: UpdatePartnerDto, @ReqMeta() meta: RequestMeta) {
    return this.partners.update(user, id, dto, meta);
  }

  @Delete(':id') @HttpCode(204) @RequirePermissions('partner.manage')
  remove(@CurrentUser() user: AuthUser, @Param('id') id: string, @ReqMeta() meta: RequestMeta) {
    return this.partners.remove(user, id, meta);
  }
}
