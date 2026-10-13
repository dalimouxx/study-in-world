import { Injectable } from '@nestjs/common';
import { TimelineEntityType, TimelineType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import type { Paginated } from '../common/pagination';

@Injectable()
export class TimelineService {
  constructor(private readonly prisma: PrismaService) {}

  add(
    organizationId: string,
    entityType: TimelineEntityType,
    entityId: string,
    type: TimelineType,
    content: string,
    createdById?: string,
  ) {
    return this.prisma.timelineEntry.create({
      data: { organizationId, entityType, entityId, type, content, createdById },
    });
  }

  async list(organizationId: string, entityType: TimelineEntityType, entityId: string, page: number, pageSize: number): Promise<Paginated<unknown>> {
    const where = { organizationId, entityType, entityId };
    const [total, rows] = await this.prisma.$transaction([
      this.prisma.timelineEntry.count({ where }),
      this.prisma.timelineEntry.findMany({ where, orderBy: { createdAt: 'desc' }, skip: (page - 1) * pageSize, take: pageSize }),
    ]);
    const userIds = [...new Set(rows.map((r) => r.createdById).filter((v): v is string => !!v))];
    const users = await this.prisma.user.findMany({ where: { id: { in: userIds } }, select: { id: true, firstName: true, lastName: true } });
    const names = new Map(users.map((u) => [u.id, `${u.firstName} ${u.lastName}`]));
    return {
      total,
      page,
      pageSize,
      items: rows.map((r) => ({ ...r, createdByName: r.createdById ? names.get(r.createdById) ?? null : null })),
    };
  }
}
