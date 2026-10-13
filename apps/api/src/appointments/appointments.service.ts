import { HttpStatus, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { apiError } from '../common/errors/api-error';
import type { AuthUser } from '../common/auth-user';
import { CreateAppointmentDto, ListAppointmentsQuery, UpdateAppointmentDto } from './dto/appointment.dto';

@Injectable()
export class AppointmentsService {
  constructor(private readonly prisma: PrismaService) {}

  list(actor: AuthUser, q: ListAppointmentsQuery) {
    const where: Prisma.AppointmentWhereInput = {
      organizationId: actor.organizationId,
      ...(q.from || q.to ? { startAt: { ...(q.from ? { gte: new Date(q.from) } : {}), ...(q.to ? { lte: new Date(q.to) } : {}) } } : {}),
    };
    return this.prisma.appointment.findMany({ where, orderBy: { startAt: 'asc' } });
  }

  create(actor: AuthUser, dto: CreateAppointmentDto) {
    return this.prisma.appointment.create({
      data: {
        organizationId: actor.organizationId,
        title: dto.title,
        startAt: new Date(dto.startAt),
        endAt: new Date(dto.endAt),
        location: dto.location,
        branchId: dto.branchId ?? actor.branchId,
        relatedType: dto.relatedType,
        relatedId: dto.relatedId,
        createdById: actor.id,
      },
    });
  }

  async update(actor: AuthUser, id: string, dto: UpdateAppointmentDto) {
    await this.find(actor, id);
    return this.prisma.appointment.update({
      where: { id },
      data: { ...dto, startAt: dto.startAt ? new Date(dto.startAt) : undefined, endAt: dto.endAt ? new Date(dto.endAt) : undefined },
    });
  }

  async remove(actor: AuthUser, id: string): Promise<void> {
    await this.find(actor, id);
    await this.prisma.appointment.delete({ where: { id } });
  }

  private async find(actor: AuthUser, id: string) {
    const appt = await this.prisma.appointment.findFirst({ where: { id, organizationId: actor.organizationId } });
    if (!appt) throw apiError(HttpStatus.NOT_FOUND, 'NOT_FOUND', 'Rendez-vous introuvable');
    return appt;
  }
}
