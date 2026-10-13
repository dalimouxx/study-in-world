import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser, RequirePermissions } from '../common/decorators';
import type { AuthUser } from '../common/auth-user';
import { CreateTaskDto, ListTasksQuery, UpdateTaskDto } from './dto/task.dto';
import { TasksService } from './tasks.service';

@ApiTags('tasks')
@ApiBearerAuth()
@Controller('tasks')
export class TasksController {
  constructor(private readonly tasks: TasksService) {}

  @Get() @RequirePermissions('task.view')
  list(@CurrentUser() user: AuthUser, @Query() q: ListTasksQuery) {
    return this.tasks.list(user, q);
  }

  @Post() @RequirePermissions('task.manage')
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateTaskDto) {
    return this.tasks.create(user, dto);
  }

  @Patch(':id') @RequirePermissions('task.manage')
  update(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: UpdateTaskDto) {
    return this.tasks.update(user, id, dto);
  }

  @Delete(':id') @HttpCode(204) @RequirePermissions('task.manage')
  remove(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.tasks.remove(user, id);
  }
}
