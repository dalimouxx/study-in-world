import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CandidatesService } from '../candidates/candidates.service';
import { NotificationsService } from '../notifications/notifications.service';
import { TimelineService } from '../timeline/timeline.service';
import type { AuthUser } from '../common/auth-user';
import { SendMessageDto } from './dto/message.dto';

/**
 * Une seule conversation implicite par candidat (section 52) : côté employé, accessible depuis le dossier
 * candidat ; côté candidat, via le portail (voir PortalService, qui appelle les mêmes méthodes).
 */
@Injectable()
export class MessagesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly candidates: CandidatesService,
    private readonly notifications: NotificationsService,
    private readonly timeline: TimelineService,
  ) {}

  async list(organizationId: string, candidateId: string) {
    return this.prisma.message.findMany({ where: { organizationId, candidateId }, orderBy: { createdAt: 'asc' } });
  }

  async sendFromStaff(actor: AuthUser, candidateId: string, dto: SendMessageDto) {
    await this.candidates.assertBelongs(actor.organizationId, candidateId);
    const message = await this.prisma.message.create({
      data: { organizationId: actor.organizationId, candidateId, sender: 'STAFF', senderId: actor.id, content: dto.content, readByStaffAt: new Date() },
    });
    await this.timeline.add(actor.organizationId, 'CANDIDATE', candidateId, 'EMAIL', `Message envoyé au candidat : « ${dto.content.slice(0, 80)}${dto.content.length > 80 ? '…' : ''} »`, actor.id);
    return message;
  }

  async sendFromCandidate(organizationId: string, candidateId: string, content: string) {
    const message = await this.prisma.message.create({
      data: { organizationId, candidateId, sender: 'CANDIDATE', content, readByCandidateAt: new Date() },
    });
    await this.timeline.add(organizationId, 'CANDIDATE', candidateId, 'EMAIL', `Message reçu du candidat : « ${content.slice(0, 80)}${content.length > 80 ? '…' : ''} »`);

    const candidate = await this.prisma.candidate.findUnique({ where: { id: candidateId }, select: { firstName: true, lastName: true, assignedToId: true } });
    if (candidate?.assignedToId) {
      await this.notifications.notify(
        organizationId,
        candidate.assignedToId,
        'NEW_MESSAGE',
        `Message de ${candidate.firstName} ${candidate.lastName}`,
        content.slice(0, 140),
        `/candidates/${candidateId}`,
      );
    }
    return message;
  }

  /** Marque comme lus, du point de vue employé, tous les messages envoyés par le candidat. */
  async markReadByStaff(organizationId: string, candidateId: string): Promise<void> {
    await this.prisma.message.updateMany({ where: { organizationId, candidateId, sender: 'CANDIDATE', readByStaffAt: null }, data: { readByStaffAt: new Date() } });
  }

  /** Marque comme lus, du point de vue candidat, tous les messages envoyés par l'équipe. */
  async markReadByCandidate(organizationId: string, candidateId: string): Promise<void> {
    await this.prisma.message.updateMany({ where: { organizationId, candidateId, sender: 'STAFF', readByCandidateAt: null }, data: { readByCandidateAt: new Date() } });
  }

  unreadCountForStaff(organizationId: string, candidateId: string) {
    return this.prisma.message.count({ where: { organizationId, candidateId, sender: 'CANDIDATE', readByStaffAt: null } });
  }
}
