import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser, ReqMeta, RequirePermissions } from '../common/decorators';
import type { AuthUser, RequestMeta } from '../common/auth-user';
import { CashboxService } from './cashbox.service';
import { CloseCashboxDto, OpenCashboxDto } from './dto/cashbox.dto';

@ApiTags('cashbox')
@ApiBearerAuth()
@Controller('cashbox')
export class CashboxController {
  constructor(private readonly cashbox: CashboxService) {}

  @Get('current') @RequirePermissions('cashbox.manage')
  current(@CurrentUser() user: AuthUser, @Query('branchId') branchId?: string) {
    return this.cashbox.current(user, branchId);
  }

  @Get('history') @RequirePermissions('cashbox.manage')
  history(@CurrentUser() user: AuthUser, @Query('branchId') branchId?: string) {
    return this.cashbox.history(user, branchId);
  }

  @Get(':id/movements') @RequirePermissions('cashbox.manage')
  movements(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.cashbox.movements(user, id);
  }

  @Post('open') @RequirePermissions('cashbox.manage')
  open(@CurrentUser() user: AuthUser, @Body() dto: OpenCashboxDto, @ReqMeta() meta: RequestMeta) {
    return this.cashbox.open(user, dto, meta);
  }

  @Post(':id/close') @RequirePermissions('cashbox.manage')
  close(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: CloseCashboxDto, @ReqMeta() meta: RequestMeta) {
    return this.cashbox.close(user, id, dto, meta);
  }
}
