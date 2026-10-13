import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser, ReqMeta, RequirePermissions } from '../common/decorators';
import type { AuthUser, RequestMeta } from '../common/auth-user';
import { CreateExpenseDto, ListExpensesQuery } from './dto/expense.dto';
import { ExpensesService } from './expenses.service';

@ApiTags('expenses')
@ApiBearerAuth()
@Controller('expenses')
export class ExpensesController {
  constructor(private readonly expenses: ExpensesService) {}

  @Get() @RequirePermissions('expense.manage')
  list(@CurrentUser() user: AuthUser, @Query() q: ListExpensesQuery) {
    return this.expenses.list(user, q);
  }

  @Post() @RequirePermissions('expense.manage')
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateExpenseDto, @ReqMeta() meta: RequestMeta) {
    return this.expenses.create(user, dto, meta);
  }
}
