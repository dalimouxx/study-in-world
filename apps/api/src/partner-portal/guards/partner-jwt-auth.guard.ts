import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

/** Jamais enregistré globalement : appliqué explicitement avec @UseGuards sur les routes du portail partenaire. */
@Injectable()
export class PartnerJwtAuthGuard extends AuthGuard('partner-jwt') {}
