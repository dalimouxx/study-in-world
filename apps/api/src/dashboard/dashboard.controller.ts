import { Controller, Get } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators';
import type { AuthUser } from '../common/auth-user';
import { DashboardService } from './dashboard.service';

@ApiTags('dashboard')
@ApiBearerAuth()
@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboard: DashboardService) {}

  @Get('deadlines')
  deadlines(@CurrentUser() user: AuthUser) {
    return this.dashboard.deadlines(user);
  }
}
