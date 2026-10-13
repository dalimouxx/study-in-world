import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser, ReqMeta, RequirePermissions } from '../common/decorators';
import type { AuthUser, RequestMeta } from '../common/auth-user';
import { CreateEmployeeDto, ListEmployeesQuery, UpdateEmployeeDto } from './dto/employee.dto';
import { EmployeesService } from './employees.service';

@ApiTags('employees')
@ApiBearerAuth()
@Controller('employees')
export class EmployeesController {
  constructor(private readonly employees: EmployeesService) {}

  @Get() @RequirePermissions('employee.view')
  list(@CurrentUser() user: AuthUser, @Query() q: ListEmployeesQuery) {
    return this.employees.list(user, q);
  }

  @Get(':id') @RequirePermissions('employee.view')
  get(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.employees.get(user, id);
  }

  @Post() @RequirePermissions('employee.create')
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateEmployeeDto, @ReqMeta() meta: RequestMeta) {
    return this.employees.create(user, dto, meta);
  }

  @Patch(':id') @RequirePermissions('employee.edit')
  update(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: UpdateEmployeeDto, @ReqMeta() meta: RequestMeta) {
    return this.employees.update(user, id, dto, meta);
  }

  @Delete(':id') @HttpCode(204) @RequirePermissions('employee.delete')
  remove(@CurrentUser() user: AuthUser, @Param('id') id: string, @ReqMeta() meta: RequestMeta) {
    return this.employees.remove(user, id, meta);
  }
}
