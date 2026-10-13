import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

/**
 * Jamais enregistré globalement (contrairement au JwtAuthGuard employé) : appliqué explicitement avec
 * @UseGuards sur les seules routes du portail candidat.
 */
@Injectable()
export class CandidateJwtAuthGuard extends AuthGuard('candidate-jwt') {}
