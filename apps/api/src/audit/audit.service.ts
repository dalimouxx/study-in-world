import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import type { RequestMeta } from '../common/auth-user';
import type { Paginated } from '../common/pagination';

export interface AuditEntry {
  organizationId: string;
  userId?: string | null;
  action: string;
  entity: string;
  entityId?: string | null;
  metadata?: Prisma.InputJsonValue;
  meta?: RequestMeta;
}

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(private readonly prisma: PrismaService) {}

  /** Ne fait jamais échouer l'opération métier ; ne jamais y passer de mot de passe ou de secret. */
  async log(entry: AuditEntry): Promise<void> {
    try {
      await this.prisma.activityLog.create({
        data: {
          organizationId: entry.organizationId,
          userId: entry.userId ?? null,
          action: entry.action,
          entity: entry.entity,
          entityId: entry.entityId ?? null,
          metadata: entry.metadata,
          ip: entry.meta?.ip,
        },
      });
    } catch (err) {
      this.logger.error(`Échec d'écriture du journal d'audit (${entry.action})`, err as Error);
    }
  }

  async listActivity(
    organizationId: string,
    q: { page: number; pageSize: number; action?: string; entity?: string; userId?: string },
  ): Promise<Paginated<unknown>> {
    const where: Prisma.ActivityLogWhereInput = {
      organizationId,
      ...(q.action ? { action: { contains: q.action, mode: 'insensitive' } } : {}),
      ...(q.entity ? { entity: q.entity } : {}),
      ...(q.userId ? { userId: q.userId } : {}),
    };
    const [total, rows] = await this.prisma.$transaction([
      this.prisma.activityLog.count({ where }),
      this.prisma.activityLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (q.page - 1) * q.pageSize,
        take: q.pageSize,
      }),
    ]);
    const userIds = [...new Set(rows.map((r) => r.userId).filter((v): v is string => !!v))];
    const users = await this.prisma.user.findMany({
      where: { id: { in: userIds }, organizationId },
      select: { id: true, firstName: true, lastName: true },
    });
    const names = new Map(users.map((u) => [u.id, `${u.firstName} ${u.lastName}`]));
    return {
      total,
      page: q.page,
      pageSize: q.pageSize,
      items: rows.map((r) => ({ ...r, userName: r.userId ? (names.get(r.userId) ?? null) : null })),
    };
  }

  async listLogins(
    organizationId: string,
    q: { page: number; pageSize: number; success?: boolean },
  ): Promise<Paginated<unknown>> {
    const where: Prisma.LoginLogWhereInput = {
      organizationId,
      ...(q.success !== undefined ? { success: q.success } : {}),
    };
    const [total, items] = await this.prisma.$transaction([
      this.prisma.loginLog.count({ where }),
      this.prisma.loginLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (q.page - 1) * q.pageSize,
        take: q.pageSize,
      }),
    ]);
    return { total, page: q.page, pageSize: q.pageSize, items };
  }
}
