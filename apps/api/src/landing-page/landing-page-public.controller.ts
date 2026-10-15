import { Controller, Get } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import { HttpStatus } from '@nestjs/common';
import { Public } from '../common/decorators';
import { apiError } from '../common/errors/api-error';
import { PrismaService } from '../prisma/prisma.service';
import type { Env } from '../config/env';
import { LandingPageService } from './landing-page.service';

/** Contenu CMS de la landing page, en lecture, sans authentification — consommé par le site public. */
@ApiTags('public')
@Controller('public/landing-page')
export class LandingPagePublicController {
  constructor(
    private readonly landingPage: LandingPageService,
    private readonly prisma: PrismaService,
    private readonly config: ConfigService<Env, true>,
  ) {}

  @Public() @Get()
  async get() {
    const slug = this.config.get('DEFAULT_ORG_SLUG', { infer: true });
    const org = await this.prisma.organization.findFirst({ where: { slug, isActive: true }, select: { id: true } });
    if (!org) throw apiError(HttpStatus.NOT_FOUND, 'NOT_FOUND', 'Agence introuvable');
    return this.landingPage.getPublic(org.id);
  }
}
