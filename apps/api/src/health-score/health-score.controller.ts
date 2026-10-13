import { Controller, Get, Param } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser, RequirePermissions } from '../common/decorators';
import type { AuthUser } from '../common/auth-user';
import { HealthScoreService } from './health-score.service';

@ApiTags('health-score')
@ApiBearerAuth()
@Controller('candidates/:candidateId/health-score')
export class HealthScoreController {
  constructor(private readonly healthScore: HealthScoreService) {}

  @Get() @RequirePermissions('candidate.view')
  get(@CurrentUser() user: AuthUser, @Param('candidateId') candidateId: string) {
    return this.healthScore.compute(user, candidateId);
  }
}
