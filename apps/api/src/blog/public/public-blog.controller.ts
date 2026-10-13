import { Controller, Get, HttpStatus, Param, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import { Public } from '../../common/decorators';
import { PrismaService } from '../../prisma/prisma.service';
import { apiError } from '../../common/errors/api-error';
import { skipTake } from '../../common/pagination';
import type { Env } from '../../config/env';

/** Blog public, sans authentification, uniquement les articles publiés (Phase 11). */
@ApiTags('public')
@Controller('public/blog')
export class PublicBlogController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService<Env, true>,
  ) {}

  private async orgId(): Promise<string> {
    const slug = this.config.get('DEFAULT_ORG_SLUG', { infer: true });
    const org = await this.prisma.organization.findFirst({ where: { slug, isActive: true }, select: { id: true } });
    if (!org) throw apiError(HttpStatus.NOT_FOUND, 'NOT_FOUND', 'Agence introuvable');
    return org.id;
  }

  @Public()
  @Get()
  async list(@Query('page') page = '1', @Query('pageSize') pageSize = '9') {
    const organizationId = await this.orgId();
    const where = { organizationId, status: 'PUBLISHED' as const };
    const q = { page: Number(page) || 1, pageSize: Math.min(Number(pageSize) || 9, 24) };
    const [items, total] = await Promise.all([
      this.prisma.blogPost.findMany({
        where,
        select: { id: true, slug: true, title: true, excerpt: true, coverImageUrl: true, publishedAt: true },
        orderBy: { publishedAt: 'desc' },
        ...skipTake(q),
      }),
      this.prisma.blogPost.count({ where }),
    ]);
    return { items, total, page: q.page, pageSize: q.pageSize };
  }

  @Public()
  @Get(':slug')
  async bySlug(@Param('slug') slug: string) {
    const organizationId = await this.orgId();
    const post = await this.prisma.blogPost.findFirst({
      where: { organizationId, slug, status: 'PUBLISHED' },
      select: { id: true, slug: true, title: true, excerpt: true, content: true, coverImageUrl: true, publishedAt: true },
    });
    if (!post) throw apiError(HttpStatus.NOT_FOUND, 'NOT_FOUND', 'Article introuvable');
    return post;
  }
}
