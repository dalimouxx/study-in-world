import { Body, Controller, Delete, Get, HttpCode, Param, Post, Put } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser, ReqMeta, RequirePermissions } from '../common/decorators';
import type { AuthUser, RequestMeta } from '../common/auth-user';
import { CreateRoleDto, SetPermissionsDto } from './dto/role.dto';
import { RolesService } from './roles.service';

@ApiTags('roles')
@ApiBearerAuth()
@Controller('roles')
export class RolesController {
  constructor(private readonly roles: RolesService) {}

  @Get() @RequirePermissions('role.view')
  list(@CurrentUser() user: AuthUser) {
    return this.roles.list(user);
  }

  @Get('permissions') @RequirePermissions('role.view')
  catalog() {
    return this.roles.catalog();
  }

  @Post() @RequirePermissions('role.manage')
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateRoleDto, @ReqMeta() meta: RequestMeta) {
    return this.roles.create(user, dto, meta);
  }

  @Put(':id/permissions') @HttpCode(204) @RequirePermissions('role.manage')
  setPermissions(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: SetPermissionsDto, @ReqMeta() meta: RequestMeta) {
    return this.roles.setPermissions(user, id, dto.permissions, meta);
  }

  @Delete(':id') @HttpCode(204) @RequirePermissions('role.manage')
  remove(@CurrentUser() user: AuthUser, @Param('id') id: string, @ReqMeta() meta: RequestMeta) {
    return this.roles.remove(user, id, meta);
  }
}
