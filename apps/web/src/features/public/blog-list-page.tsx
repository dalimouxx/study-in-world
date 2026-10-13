'use client';

import { useQuery } from '@tanstack/react-query';
import { Newspaper } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { EmptyState } from '@/components/empty-state';
import { Link } from '@/i18n/navigation';
import { api } from '@/lib/api';
import type { Paginated, PublicBlogPost } from '@/lib/types';
import { Reveal, RevealGroup, RevealItem } from './design-system';
import { PublicShell } from './public-shell';

export function BlogListPage() {
  const t = useTranslations('public');
  const tc = useTranslations('common');
  const query = useQuery({ queryKey: ['public', 'blog'], queryFn: () => api<Paginated<PublicBlogPost>>('/public/blog', { auth: false, query: { pageSize: 12 } }) });
  const items = query.data?.items ?? [];

  return (
    <PublicShell>
      <section className="mx-auto max-w-6xl px-6 py-14">
        <Reveal className="mx-auto max-w-2xl text-center">
          <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
            <Newspaper className="h-5 w-5" aria-hidden />
          </span>
          <h1 className="mt-3 font-poppins text-3xl font-bold text-navy">{t('blogTitle')}</h1>
          <p className="mt-2 text-muted-foreground">{t('blogSubtitle')}</p>
        </Reveal>

        {query.isLoading ? (
          <p role="status" className="mt-10 text-center text-sm text-muted-foreground">{tc('loading')}</p>
        ) : items.length === 0 ? (
          <div className="mt-10"><EmptyState title={t('emptyBlog')} /></div>
        ) : (
          <RevealGroup className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {items.map((post) => (
              <RevealItem key={post.id}>
                <Link href={`/blog/${post.slug}`} className="group flex h-full flex-col overflow-hidden rounded-organic bg-white shadow-[0_10px_35px_-18px_rgba(7,44,122,0.35)] transition-transform hover:-translate-y-1">
                  {post.coverImageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={post.coverImageUrl} alt="" className="h-44 w-full object-cover transition-transform duration-500 group-hover:scale-105" />
                  ) : (
                    <div className="flex h-44 w-full items-center justify-center bg-gradient-to-br from-navy to-primary">
                      <Newspaper className="h-8 w-8 text-white/70" aria-hidden />
                    </div>
                  )}
                  <div className="flex flex-1 flex-col p-5">
                    <p className="font-poppins font-semibold text-navy">{post.title}</p>
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
