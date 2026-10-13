import { Body, Controller, Get, HttpCode, Param, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser, RequirePermissions } from '../common/decorators';
import type { AuthUser } from '../common/auth-user';
import { SendMessageDto } from './dto/message.dto';
import { MessagesService } from './messages.service';

@ApiTags('messages')
@ApiBearerAuth()
@Controller('candidates/:candidateId/messages')
export class MessagesController {
  constructor(private readonly messages: MessagesService) {}

  @Get() @RequirePermissions('candidate.view')
  list(@CurrentUser() user: AuthUser, @Param('candidateId') candidateId: string) {
    return this.messages.list(user.organizationId, candidateId);
  }

  @Post() @RequirePermissions('candidate.manage')
  send(@CurrentUser() user: AuthUser, @Param('candidateId') candidateId: string, @Body() dto: SendMessageDto) {
    return this.messages.sendFromStaff(user, candidateId, dto);
  }

  @Post('read') @HttpCode(204) @RequirePermissions('candidate.view')
  markRead(@CurrentUser() user: AuthUser, @Param('candidateId') candidateId: string) {
    return this.messages.markReadByStaff(user.organizationId, candidateId);
  }
}
