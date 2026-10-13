import { HttpStatus, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { apiError } from '../common/errors/api-error';
import { Paginated, skipTake } from '../common/pagination';
import type { AuthUser, RequestMeta } from '../common/auth-user';
import { CreateBlogPostDto, ListBlogPostsQuery, UpdateBlogPostDto, slugify } from './dto/blog.dto';

const include = { author: { select: { id: true, firstName: true, lastName: true } } };

/** Blog du site public (section 11) : chaque agence gère le sien, jamais visible d'une autre organisation. */
@Injectable()
export class BlogService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async list(actor: AuthUser, q: ListBlogPostsQuery): Promise<Paginated<unknown>> {
    const where = { organizationId: actor.organizationId, ...(q.status ? { status: q.status } : {}) };
    const [items, total] = await Promise.all([
      this.prisma.blogPost.findMany({ where, include, orderBy: { createdAt: 'desc' }, ...skipTake(q) }),
      this.prisma.blogPost.count({ where }),
    ]);
    return { items, total, page: q.page, pageSize: q.pageSize };
  }

  async get(actor: AuthUser, id: string) {
    const post = await this.prisma.blogPost.findFirst({ where: { id, organizationId: actor.organizationId }, include });
    if (!post) throw apiError(HttpStatus.NOT_FOUND, 'NOT_FOUND', 'Article introuvable');
    return post;
  }

  async create(actor: AuthUser, dto: CreateBlogPostDto, meta: RequestMeta) {
    const baseSlug = dto.slug || slugify(dto.title);
    const slug = await this.uniqueSlug(actor.organizationId, baseSlug);
    const post = await this.prisma.blogPost.create({
      data: {
        organizationId: actor.organizationId,
        authorId: actor.id,
        slug,
        title: dto.title,
        excerpt: dto.excerpt,
        content: dto.content,
        coverImageUrl: dto.coverImageUrl,
      },
      include,
    });
    await this.audit.log({ organizationId: actor.organizationId, userId: actor.id, action: 'blog.create', entity: 'BlogPost', entityId: post.id, meta });
    return post;
  }

  async update(actor: AuthUser, id: string, dto: UpdateBlogPostDto, meta: RequestMeta) {
    await this.get(actor, id);
    const wasPublished = dto.status === 'PUBLISHED';
    const post = await this.prisma.blogPost.update({
      where: { id },
      data: {
        ...dto,
        ...(wasPublished ? { publishedAt: new Date() } : {}),
      },
      include,
    });
    await this.audit.log({ organizationId: actor.organizationId, userId: actor.id, action: 'blog.update', entity: 'BlogPost', entityId: post.id, meta });
    return post;
  }

  async remove(actor: AuthUser, id: string, meta: RequestMeta) {
    await this.get(actor, id);
    await this.prisma.blogPost.delete({ where: { id } });
    await this.audit.log({ organizationId: actor.organizationId, userId: actor.id, action: 'blog.delete', entity: 'BlogPost', entityId: id, meta });
  }

  private async uniqueSlug(organizationId: string, base: string): Promise<string> {
    let candidate = base || 'article';
    let n = 1;
    while (await this.prisma.blogPost.findUnique({ where: { organizationId_slug: { organizationId, slug: candidate } } })) {
      candidate = `${base}-${++n}`;
    }
    return candidate;
  }
}
