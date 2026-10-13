import { HttpStatus, Injectable } from '@nestjs/common';
import { NotificationType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { apiError } from '../common/errors/api-error';
import type { AuthUser } from '../common/auth-user';

/**
 * Notifications (via interrogation régulière plutôt que WebSocket — section « jamais construit »).
 * Deux déclencheurs pour l'instant : un message reçu d'un candidat (pour son conseiller), une tâche assignée
 * à quelqu'un d'autre que soi-même. Volontairement limité à ces deux cas plutôt que de tout notifier — trop
 * de notifications rend la cloche inutile aussi sûrement que pas de notification du tout.
 */
@Injectable()
export class NotificationsService {
  constructor(private readonly prisma: PrismaService) {}

  async notify(organizationId: string, userId: string, type: NotificationType, title: string, body: string, link?: string) {
    return this.prisma.notification.create({ data: { organizationId, userId, type, title, body, link } });
  }

  async list(actor: AuthUser) {
    return this.prisma.notification.findMany({
      where: { organizationId: actor.organizationId, userId: actor.id },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }

  async unreadCount(actor: AuthUser): Promise<number> {
    return this.prisma.notification.count({ where: { organizationId: actor.organizationId, userId: actor.id, readAt: null } });
  }

  async markRead(actor: AuthUser, id: string) {
    const existing = await this.prisma.notification.findFirst({ where: { id, organizationId: actor.organizationId, userId: actor.id } });
    if (!existing) throw apiError(HttpStatus.NOT_FOUND, 'NOT_FOUND', 'Notification introuvable');
    if (existing.readAt) return existing;
    return this.prisma.notification.update({ where: { id }, data: { readAt: new Date() } });
  }

  async markAllRead(actor: AuthUser): Promise<void> {
    await this.prisma.notification.updateMany({
      where: { organizationId: actor.organizationId, userId: actor.id, readAt: null },
      data: { readAt: new Date() },
    });
  }
}
