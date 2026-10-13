import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser, ReqMeta, RequirePermissions } from '../common/decorators';
import type { AuthUser, RequestMeta } from '../common/auth-user';
import { CreateBranchDto, UpdateBranchDto } from './dto/branch.dto';
import { BranchesService } from './branches.service';

@ApiTags('branches')
@ApiBearerAuth()
@Controller('branches')
export class BranchesController {
  constructor(private readonly branches: BranchesService) {}

  // Lecture ouverte à tout employé connecté : nécessaire aux listes déroulantes (employés, filtres).
  @Get()
  list(@CurrentUser() user: AuthUser) {
    return this.branches.list(user);
  }

  @Post() @RequirePermissions('branch.manage')
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateBranchDto, @ReqMeta() meta: RequestMeta) {
    return this.branches.create(user, dto, meta);
  }

  @Patch(':id') @RequirePermissions('branch.manage')
  update(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: UpdateBranchDto, @ReqMeta() meta: RequestMeta) {
    return this.branches.update(user, id, dto, meta);
  }

  @Delete(':id') @HttpCode(204) @RequirePermissions('branch.manage')
  remove(@CurrentUser() user: AuthUser, @Param('id') id: string, @ReqMeta() meta: RequestMeta) {
    return this.branches.remove(user, id, meta);
  }
}
