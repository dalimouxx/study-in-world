import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import { Public } from '../../common/decorators';
import { PrismaService } from '../../prisma/prisma.service';
import { apiError } from '../../common/errors/api-error';
import { HttpStatus } from '@nestjs/common';
import type { Env } from '../../config/env';
import { ProgramsService } from '../programs.service';
import { SearchProgramsQuery } from '../dto/program.dto';

/**
 * Catalogue en lecture, sans authentification, pour le site public (Phase 11) : destinations,
 * universités, programmes, recherche, comparateur. Toujours filtré sur `isActive: true`.
 */
@ApiTags('public')
@Controller('public/catalog')
export class PublicCatalogController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly programsService: ProgramsService,
    private readonly config: ConfigService<Env, true>,
  ) {}

  private async orgId(): Promise<string> {
    const slug = this.config.get('DEFAULT_ORG_SLUG', { infer: true });
    const org = await this.prisma.organization.findFirst({ where: { slug, isActive: true }, select: { id: true } });
    if (!org) throw apiError(HttpStatus.NOT_FOUND, 'NOT_FOUND', 'Agence introuvable');
    return org.id;
  }

  @Public() @Get('countries')
  async countries() {
    const organizationId = await this.orgId();
    return this.prisma.country.findMany({ where: { organizationId, isActive: true, deletedAt: null }, orderBy: { name: 'asc' } });
  }

  /** Chiffres affichés comme preuve sociale sur la landing page (section « stats ») : toujours réels, jamais figés en dur. */
  @Public() @Get('stats')
  async stats() {
    const organizationId = await this.orgId();
    const [countries, universities, programs] = await this.prisma.$transaction([
      this.prisma.country.count({ where: { organizationId, isActive: true, deletedAt: null } }),
      this.prisma.university.count({ where: { organizationId, isActive: true, deletedAt: null } }),
      this.prisma.program.count({ where: { organizationId, isActive: true, deletedAt: null } }),
    ]);
    return { countries, universities, programs };
  }

  @Public() @Get('countries/:slug')
  async country(@Param('slug') slug: string) {
    const organizationId = await this.orgId();
    const found = await this.prisma.country.findFirst({
      where: { organizationId, slug, isActive: true, deletedAt: null },
      include: { universities: { where: { isActive: true, deletedAt: null }, orderBy: { name: 'asc' } } },
    });
    if (!found) throw apiError(HttpStatus.NOT_FOUND, 'NOT_FOUND', 'Destination introuvable');
    return found;
  }

  @Public() @Get('universities/:slug')
  async university(@Param('slug') slug: string) {
    const organizationId = await this.orgId();
    const found = await this.prisma.university.findFirst({
      where: { organizationId, slug, isActive: true, deletedAt: null },
      include: {
        country: { select: { id: true, name: true, slug: true, flagEmoji: true } },
        programs: { where: { isActive: true, deletedAt: null }, orderBy: { name: 'asc' } },
      },
    });
    if (!found) throw apiError(HttpStatus.NOT_FOUND, 'NOT_FOUND', 'Université introuvable');
    return found;
  }

  @Public() @Get('programs')
  async programs(@Query() q: SearchProgramsQuery) {
    const organizationId = await this.orgId();
    return this.programsService.search(organizationId, { ...q, includeInactive: undefined });
  }

  @Public() @Get('programs/compare')
  async compare(@Query('ids') ids: string) {
    const organizationId = await this.orgId();
    return this.programsService.compare(organizationId, (ids ?? '').split(',').filter(Boolean));
  }

  @Public() @Get('programs/:slug')
  async program(@Param('slug') slug: string) {
    const organizationId = await this.orgId();
    const found = await this.prisma.program.findFirst({
      where: { organizationId, slug, isActive: true, deletedAt: null },
      include: { university: { include: { country: true } } },
    });
    if (!found) throw apiError(HttpStatus.NOT_FOUND, 'NOT_FOUND', 'Programme introuvable');
    return found;
  }
}
