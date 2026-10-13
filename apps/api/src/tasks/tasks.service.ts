import { HttpStatus, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { apiError } from '../common/errors/api-error';
import type { AuthUser } from '../common/auth-user';
import { Paginated, skipTake } from '../common/pagination';
import { CreateTaskDto, ListTasksQuery, UpdateTaskDto } from './dto/task.dto';

const include = { assignedTo: { select: { id: true, firstName: true, lastName: true } } } satisfies Prisma.TaskInclude;
type TaskWithRelations = Prisma.TaskGetPayload<{ include: typeof include }>;

@Injectable()
export class TasksService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  async list(actor: AuthUser, q: ListTasksQuery): Promise<Paginated<TaskWithRelations>> {
    const where: Prisma.TaskWhereInput = {
      organizationId: actor.organizationId,
      ...(q.status ? { status: q.status } : {}),
      ...(q.mine === 'true' ? { assignedToId: actor.id } : q.assignedToId ? { assignedToId: q.assignedToId } : {}),
    };
    const [total, items] = await this.prisma.$transaction([
      this.prisma.task.count({ where }),
      this.prisma.task.findMany({ where, include, orderBy: [{ status: 'asc' }, { dueDate: 'asc' }], ...skipTake(q) }),
    ]);
    return { items, total, page: q.page, pageSize: q.pageSize };
  }

  async create(actor: AuthUser, dto: CreateTaskDto) {
    const assignedToId = dto.assignedToId ?? actor.id;
    const task = await this.prisma.task.create({
      data: {
        organizationId: actor.organizationId,
        title: dto.title,
        description: dto.description,
        dueDate: dto.dueDate ? new Date(dto.dueDate) : undefined,
        assignedToId,
        priority: dto.priority,
        relatedType: dto.relatedType,
        relatedId: dto.relatedId,
        createdById: actor.id,
      },
      include,
    });
    if (assignedToId !== actor.id) {
      await this.notifications.notify(actor.organizationId, assignedToId, 'TASK_ASSIGNED', 'Nouvelle tâche assignée', task.title, '/tasks');
    }
    return task;
  }

  async update(actor: AuthUser, id: string, dto: UpdateTaskDto) {
    const before = await this.find(actor, id);
    const task = await this.prisma.task.update({
      where: { id },
      data: { ...dto, dueDate: dto.dueDate ? new Date(dto.dueDate) : undefined },
      include,
    });
    // Ne notifie que si la personne assignée change réellement, et jamais quand on se l'assigne à soi-même.
    if (dto.assignedToId && dto.assignedToId !== before.assignedToId && dto.assignedToId !== actor.id) {
      await this.notifications.notify(actor.organizationId, dto.assignedToId, 'TASK_ASSIGNED', 'Nouvelle tâche assignée', task.title, '/tasks');
    }
    return task;
  }

  async remove(actor: AuthUser, id: string): Promise<void> {
    await this.find(actor, id);
    await this.prisma.task.delete({ where: { id } });
  }

  private async find(actor: AuthUser, id: string) {
    const task = await this.prisma.task.findFirst({ where: { id, organizationId: actor.organizationId } });
    if (!task) throw apiError(HttpStatus.NOT_FOUND, 'NOT_FOUND', 'Tâche introuvable');
    return task;
  }
}
