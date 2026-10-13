import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser, RequirePermissions } from '../common/decorators';
import type { AuthUser } from '../common/auth-user';
import { AppointmentsService } from './appointments.service';
import { CreateAppointmentDto, ListAppointmentsQuery, UpdateAppointmentDto } from './dto/appointment.dto';

@ApiTags('appointments')
@ApiBearerAuth()
@Controller('appointments')
export class AppointmentsController {
  constructor(private readonly appointments: AppointmentsService) {}

  @Get() @RequirePermissions('appointment.view')
  list(@CurrentUser() user: AuthUser, @Query() q: ListAppointmentsQuery) {
    return this.appointments.list(user, q);
  }

  @Post() @RequirePermissions('appointment.manage')
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateAppointmentDto) {
    return this.appointments.create(user, dto);
  }

  @Patch(':id') @RequirePermissions('appointment.manage')
  update(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: UpdateAppointmentDto) {
    return this.appointments.update(user, id, dto);
  }

  @Delete(':id') @HttpCode(204) @RequirePermissions('appointment.manage')
  remove(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.appointments.remove(user, id);
  }
}
