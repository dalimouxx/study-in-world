import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class CounterService {
  constructor(private readonly prisma: PrismaService) {}

  /** Incrémente et retourne un numéro séquentiel par organisation/clé/année (ex: FAC-2026-0007). */
  async next(organizationId: string, key: string, prefix: string): Promise<string> {
    const year = new Date().getFullYear();
    const counter = await this.prisma.counter.upsert({
      where: { organizationId_key_year: { organizationId, key, year } },
      update: { value: { increment: 1 } },
      create: { organizationId, key, year, value: 1 },
    });
    return `${prefix}-${year}-${String(counter.value).padStart(4, '0')}`;
  }
}
