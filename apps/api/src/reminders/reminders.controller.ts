import { Body, Controller, Get, HttpCode, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators';
import type { AuthUser } from '../common/auth-user';
import { ReminderDoneDto, TodayQueryDto } from './dto/reminder.dto';
import { RemindersService } from './reminders.service';

/** Page « Relances du jour » : permission vérifiée dans le service (candidats OU prospects). */
@ApiBearerAuth()
@ApiTags('reminders')
@Controller('reminders')
export class RemindersController {
  constructor(private readonly reminders: RemindersService) {}

  @Get('today')
  today(@CurrentUser() user: AuthUser, @Query() q: TodayQueryDto) {
    return this.reminders.today(user, q.scope ?? 'mine');
  }

  @HttpCode(200)
  @Post('done')
  done(@CurrentUser() user: AuthUser, @Body() dto: ReminderDoneDto) {
    return this.reminders.markDone(user, dto);
  }
}
