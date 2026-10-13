'use client';

import { useQuery } from '@tanstack/react-query';
import { useLocale, useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { api } from '@/lib/api';
import type { PublicBlogPost } from '@/lib/types';
import { useErrorMessage } from '@/lib/use-error-message';
import { Reveal } from './design-system';
import { PublicShell } from './public-shell';

export function BlogDetailPage({ slug }: { slug: string }) {
  const t = useTranslations('public');
  const tc = useTranslations('common');
  const locale = useLocale();
  const errorMessage = useErrorMessage();
  const query = useQuery({ queryKey: ['public', 'blog', slug], queryFn: () => api<PublicBlogPost>(`/public/blog/${slug}`, { auth: false }) });

  if (query.isLoading) return <PublicShell><p role="status" className="px-6 py-14 text-center text-sm text-muted-foreground">{tc('loading')}</p></PublicShell>;
  if (query.isError || !query.data) return <PublicShell><p role="alert" className="px-6 py-14 text-center text-sm text-destructive">{errorMessage(query.error)}</p></PublicShell>;

  const post = query.data;

  return (
    <PublicShell>
      <article className="mx-auto max-w-2xl px-6 py-14">
        <Reveal>
          {post.publishedAt && <p className="text-sm text-muted-foreground">{new Date(post.publishedAt).toLocaleDateString(locale)}</p>}
          <h1 className="mt-1 font-poppins text-3xl font-bold text-navy">{post.title}</h1>
          <p className="mt-3 text-lg text-muted-foreground">{post.excerpt}</p>
        </Reveal>
        {post.coverImageUrl && (
          <Reveal delay={0.1}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={post.coverImageUrl} alt="" className="mt-6 w-full rounded-organic object-cover shadow-lg" />
          </Reveal>
        )}
        <Reveal delay={0.15} className="prose prose-navy mt-8 max-w-none whitespace-pre-line text-foreground">
          {post.content}
        </Reveal>
        <Reveal className="mt-10 border-t border-border pt-6 text-center">
          <Link href="/blog" className="text-sm font-semibold text-primary hover:underline">{t('backToBlog')}</Link>
        </Reveal>
      </article>
    </PublicShell>
  );
}
