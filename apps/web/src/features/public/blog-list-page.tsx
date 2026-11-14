'use client';

import { useQuery } from '@tanstack/react-query';
import { Newspaper } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { EmptyState } from '@/components/empty-state';
import { Link } from '@/i18n/navigation';
import { api } from '@/lib/api';
import type { Paginated, PublicBlogPost } from '@/lib/types';
import { RevealGroup, RevealItem, PublicPageHero } from './design-system';
import { PublicShell } from './public-shell';

export function BlogListPage() {
  const t = useTranslations('public');
  const tc = useTranslations('common');
  const query = useQuery({ queryKey: ['public', 'blog'], queryFn: () => api<Paginated<PublicBlogPost>>('/public/blog', { auth: false, query: { pageSize: 12 } }) });
  const items = query.data?.items ?? [];

  return (
    <PublicShell>
      <PublicPageHero title={t('blogTitle')} subtitle={t('blogSubtitle')} />
      <section className="mx-auto max-w-6xl px-4 py-10 sm:px-6">

        {query.isLoading ? (
          <p role="status" className="mt-10 text-center text-sm text-muted-foreground">{tc('loading')}</p>
        ) : items.length === 0 ? (
          <div className="mt-10"><EmptyState title={t('emptyBlog')} /></div>
        ) : (
          <RevealGroup className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {items.map((post) => (
              <RevealItem key={post.id}>
                <Link href={`/blog/${post.slug}`} className="pop pop-hover group flex h-full flex-col overflow-hidden rounded-tile bg-card">
                  {post.coverImageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={post.coverImageUrl} alt="" className="h-44 w-full object-cover transition-transform duration-500 group-hover:scale-105" />
                  ) : (
                    <div className="flex h-44 w-full items-center justify-center border-b-2 border-ink bg-primary">
                      <Newspaper className="h-8 w-8 text-white/70" aria-hidden />
                    </div>
                  )}
                  <div className="flex flex-1 flex-col p-5">
                    <p className="font-display font-extrabold text-ink">{post.title}</p>
                    <p className="mt-1.5 flex-1 text-sm text-muted-foreground">{post.excerpt}</p>
                    {post.publishedAt && <p className="mt-3 text-xs text-muted-foreground">{new Date(post.publishedAt).toLocaleDateString()}</p>}
                  </div>
                </Link>
              </RevealItem>
            ))}
          </RevealGroup>
        )}
      </section>
    </PublicShell>
  );
}
