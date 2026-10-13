import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser, RequirePermissions } from '../common/decorators';
import type { AuthUser } from '../common/auth-user';
import { CommandCenterService } from './command-center.service';
import { ForecastQuery } from '../reports/dto/forecast.dto';

@ApiTags('command-center')
@ApiBearerAuth()
@Controller('command-center')
export class CommandCenterController {
  constructor(private readonly commandCenter: CommandCenterService) {}

  @Get('today') @RequirePermissions('command_center.view')
  today(@CurrentUser() user: AuthUser) {
    return this.commandCenter.today(user);
  }

  @Get('risks') @RequirePermissions('command_center.view')
  risks(@CurrentUser() user: AuthUser) {
    return this.commandCenter.risks(user);
  }

  @Get('finance') @RequirePermissions('command_center.view')
  finance(@CurrentUser() user: AuthUser, @Query() q: ForecastQuery) {
    return this.commandCenter.finance(user, q.period ?? '30d');
  }

  @Get('admissions') @RequirePermissions('command_center.view')
  admissions(@CurrentUser() user: AuthUser) {
    return this.commandCenter.admissions(user);
  }

  @Get('visa') @RequirePermissions('command_center.view')
  visa(@CurrentUser() user: AuthUser) {
    return this.commandCenter.visa(user);
  }
}
