import { HttpStatus, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { TimelineService } from '../timeline/timeline.service';
import { apiError } from '../common/errors/api-error';
import type { AuthUser, RequestMeta } from '../common/auth-user';
import { CandidatesService } from '../candidates/candidates.service';
import { CreateCommissionDto } from '../partners/dto/partner.dto';

type CommissionStatus = 'TO_CONFIRM' | 'EXPECTED' | 'INVOICED' | 'PARTIALLY_RECEIVED' | 'RECEIVED' | 'CANCELLED';

@Injectable()
export class CommissionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly candidates: CandidatesService,
    private readonly audit: AuditService,
    private readonly timeline: TimelineService,
  ) {}

  forCandidate(actor: AuthUser, candidateId: string) {
    return this.prisma.commission.findMany({ where: { organizationId: actor.organizationId, candidateId }, orderBy: { createdAt: 'desc' } });
  }

  forPartner(actor: AuthUser, partnerId: string) {
    return this.prisma.commission.findMany({
      where: { organizationId: actor.organizationId, partnerId },
      include: { candidate: { select: { id: true, firstName: true, lastName: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  /** Le partenaire est toujours dérivé du candidat (candidate.partnerId) — jamais choisi librement à la création. */
  async create(actor: AuthUser, candidateId: string, dto: CreateCommissionDto, meta: RequestMeta) {
    await this.candidates.assertBelongs(actor.organizationId, candidateId);
    const candidate = await this.prisma.candidate.findUniqueOrThrow({ where: { id: candidateId } });
    if (!candidate.partnerId) throw apiError(HttpStatus.BAD_REQUEST, 'CANDIDATE_HAS_NO_PARTNER', 'Ce candidat n’est lié à aucun partenaire');

    const created = await this.prisma.commission.create({
      data: {
        organizationId: actor.organizationId,
        partnerId: candidate.partnerId,
        candidateId,
        amount: dto.amount,
        currency: dto.currency,
        notes: dto.notes,
        createdById: actor.id,
      },
    });
    await this.timeline.add(actor.organizationId, 'CANDIDATE', candidateId, 'SYSTEM', `Commission créée : ${dto.amount.toFixed(3)} ${dto.currency ?? 'TND'}`, actor.id);
    await this.audit.log({ organizationId: actor.organizationId, userId: actor.id, action: 'commission.create', entity: 'Commission', entityId: created.id, metadata: { candidateId, partnerId: candidate.partnerId }, meta });
    return created;
  }

  async setStatus(actor: AuthUser, id: string, status: CommissionStatus, meta: RequestMeta) {
    const commission = await this.prisma.commission.findFirst({ where: { id, organizationId: actor.organizationId } });
    if (!commission) throw apiError(HttpStatus.NOT_FOUND, 'NOT_FOUND', 'Commission introuvable');
    const updated = await this.prisma.commission.update({ where: { id }, data: { status } });
    await this.audit.log({ organizationId: actor.organizationId, userId: actor.id, action: 'commission.status', entity: 'Commission', entityId: id, metadata: { status }, meta });
    return updated;
  }
}
