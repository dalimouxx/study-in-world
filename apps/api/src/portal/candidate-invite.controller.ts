import { Controller, HttpCode, Param, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser, RequirePermissions } from '../common/decorators';
import type { AuthUser } from '../common/auth-user';
import { CandidateAuthService } from './candidate-auth.service';

/**
 * Côté employé (jamais @Public — passe par le JwtAuthGuard employé global comme toutes les routes normales) :
 * déclenche l'envoi du lien d'activation du portail. Vit dans PortalModule (et non CandidatesModule) pour
 * éviter tout cycle d'imports entre les deux modules.
 */
@ApiTags('candidates')
@ApiBearerAuth()
@Controller('candidates')
export class CandidateInviteController {
  constructor(private readonly candidateAuth: CandidateAuthService) {}

  @Post(':id/invite') @HttpCode(204) @RequirePermissions('candidate.manage')
  invite(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.candidateAuth.invite(user, id);
  }
}
