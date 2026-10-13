import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { BlogDetailPage } from '@/features/public/blog-detail-page';
import { fetchPublicEntity, publicMetadata } from '@/lib/seo';

interface BlogPostSeoData {
  title: string;
  excerpt: string;
  coverImageUrl?: string | null;
}

export async function generateMetadata({ params }: { params: Promise<{ locale: string; slug: string }> }): Promise<Metadata> {
  const { locale, slug } = await params;
  const t = await getTranslations({ locale, namespace: 'meta' });
  const post = await fetchPublicEntity<BlogPostSeoData>(`/public/blog/${slug}`);
  const title = post?.title ?? t('title');
  const description = post?.excerpt ?? t('homeDescription');
  return publicMetadata({ locale, path: `/blog/${slug}`, title, description });
}

export default async function Page({ params }: { params: Promise<{ locale: string; slug: string }> }) {
  const { locale, slug } = await params;
  setRequestLocale(locale);
  return <BlogDetailPage slug={slug} />;
}
