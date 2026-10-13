import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser, ReqMeta } from '../common/decorators';
import type { AuthUser, RequestMeta } from '../common/auth-user';
import { PlatformAdminGuard } from './platform-admin.guard';
import { PlatformAdminService } from './platform-admin.service';
import { CreateOrganizationDto, CreatePlatformInvoiceDto, UpdateOrganizationDto, UpdatePlatformInvoiceDto } from './dto/platform-admin.dto';

@ApiTags('platform-admin')
@ApiBearerAuth()
@UseGuards(PlatformAdminGuard)
@Controller('platform-admin/organizations')
export class PlatformAdminController {
  constructor(private readonly platformAdmin: PlatformAdminService) {}

  @Get()
  list() {
    return this.platformAdmin.list();
  }

  @Get(':id')
  get(@Param('id') id: string) {
    return this.platformAdmin.get(id);
  }

  @Post()
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateOrganizationDto, @ReqMeta() meta: RequestMeta) {
    return this.platformAdmin.create(user, dto, meta);
  }

  @Patch(':id')
  update(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: UpdateOrganizationDto, @ReqMeta() meta: RequestMeta) {
    return this.platformAdmin.update(user, id, dto, meta);
  }

  @Get(':id/invoices')
  listInvoices(@Param('id') id: string) {
    return this.platformAdmin.listInvoices(id);
  }

  @Post(':id/invoices')
  createInvoice(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: CreatePlatformInvoiceDto, @ReqMeta() meta: RequestMeta) {
    return this.platformAdmin.createInvoice(user, id, dto, meta);
  }

  @Patch(':id/invoices/:invoiceId')
  updateInvoice(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Param('invoiceId') invoiceId: string,
    @Body() dto: UpdatePlatformInvoiceDto,
    @ReqMeta() meta: RequestMeta,
  ) {
    return this.platformAdmin.updateInvoice(user, id, invoiceId, dto, meta);
  }
}
