import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser, RequirePermissions } from '../common/decorators';
import type { AuthUser } from '../common/auth-user';
import { AiAssistantService } from './ai-assistant.service';
import { DraftMessageDto } from './dto/ai-assistant.dto';

@ApiTags('ai-assistant')
@ApiBearerAuth()
@Controller('candidates/:candidateId/ai')
export class AiAssistantController {
  constructor(private readonly ai: AiAssistantService) {}

  @Get('summary') @RequirePermissions('candidate.view')
  summary(@CurrentUser() user: AuthUser, @Param('candidateId') candidateId: string) {
    return this.ai.summary(user, candidateId).then((text) => ({ text }));
  }

  @Post('draft-message') @RequirePermissions('candidate.manage')
  draftMessage(@CurrentUser() user: AuthUser, @Param('candidateId') candidateId: string, @Body() dto: DraftMessageDto) {
    return this.ai.draftMessage(user, candidateId, dto.instruction).then((text) => ({ text }));
  }
}
