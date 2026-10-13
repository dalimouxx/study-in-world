import { BlogService } from './blog.service';
import type { AuthUser } from '../common/auth-user';

const actor = (): AuthUser => ({
  id: 'u1', organizationId: 'orgA', branchId: 'b1', email: 'a@a.tn', firstName: 'A', lastName: 'B',
  locale: 'fr', mustChangePassword: false, roleId: 'r1', roleCode: 'ADMIN', roleName: 'Administrateur',
  permissions: ['blog.view', 'blog.manage'],
  isPlatformAdmin: false,
});

function build() {
  const prisma = {
    blogPost: {
      findMany: jest.fn().mockResolvedValue([]),
      count: jest.fn().mockResolvedValue(0),
      findFirst: jest.fn(),
      findUnique: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockImplementation(({ data }: { data: unknown }) => Promise.resolve({ id: 'post1', ...(data as object) })),
      update: jest.fn().mockImplementation(({ data }: { data: unknown }) => Promise.resolve({ id: 'post1', ...(data as object) })),
      delete: jest.fn().mockResolvedValue(undefined),
    },
  };
  const audit = { log: jest.fn().mockResolvedValue(undefined) };
  return { service: new BlogService(prisma as never, audit as never), prisma };
}

describe('BlogService', () => {
  it('crée un article avec un slug dérivé du titre', async () => {
    const { service, prisma } = build();
    const post = await service.create(actor(), { title: 'Les visas en 2026', excerpt: 'Un guide complet pour préparer son dossier.', content: 'Contenu suffisamment long pour passer la validation.' }, {});
    expect(prisma.blogPost.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ organizationId: 'orgA', slug: 'les-visas-en-2026', authorId: 'u1' }),
    }));
    expect(post.slug).toBe('les-visas-en-2026');
  });

  it('ajoute un suffixe numérique si le slug existe déjà dans cette organisation', async () => {
    const { service, prisma } = build();
    prisma.blogPost.findUnique.mockResolvedValueOnce({ id: 'existing' }).mockResolvedValueOnce(null);
    await service.create(actor(), { title: 'Malte', excerpt: 'Une destination européenne accessible et abordable.', content: 'Contenu suffisamment long pour passer la validation ici.' }, {});
    expect(prisma.blogPost.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ slug: 'malte-2' }) }));
  });

  it('fixe publishedAt au moment précis où le statut passe à PUBLISHED', async () => {
    const { service, prisma } = build();
    prisma.blogPost.findFirst.mockResolvedValue({ id: 'post1', organizationId: 'orgA' });
    await service.update(actor(), 'post1', { status: 'PUBLISHED' }, {});
    expect(prisma.blogPost.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ status: 'PUBLISHED', publishedAt: expect.any(Date) }),
    }));
  });

  it('refuse d’accéder à un article d’une autre organisation', async () => {
    const { service, prisma } = build();
    prisma.blogPost.findFirst.mockResolvedValue(null); // le filtre organizationId de la requête l'exclut déjà
    await expect(service.get(actor(), 'post-from-another-org')).rejects.toMatchObject({ status: 404 });
  });
});
