import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { UniversityDetailPage } from '@/features/public/university-detail-page';
import { fetchPublicEntity, publicMetadata } from '@/lib/seo';

export async function generateMetadata({ params }: { params: Promise<{ locale: string; slug: string }> }): Promise<Metadata> {
  const { locale, slug } = await params;
  const t = await getTranslations({ locale, namespace: 'meta' });
  const university = await fetchPublicEntity<{ name: string; city: string }>(`/public/catalog/universities/${slug}`);
  const title = university?.name ?? t('title');
  const description = university ? t('universityFallback', { university: university.name, city: university.city }) : t('homeDescription');
  return publicMetadata({ locale, path: `/universities/${slug}`, title, description });
}

export default async function Page({ params }: { params: Promise<{ locale: string; slug: string }> }) {
  const { locale, slug } = await params;
  setRequestLocale(locale);
  return <UniversityDetailPage slug={slug} />;
}
