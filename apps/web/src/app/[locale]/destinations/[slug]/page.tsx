import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { DestinationDetailPage } from '@/features/public/destination-detail-page';
import { fetchPublicEntity, publicMetadata } from '@/lib/seo';

export async function generateMetadata({ params }: { params: Promise<{ locale: string; slug: string }> }): Promise<Metadata> {
  const { locale, slug } = await params;
  const t = await getTranslations({ locale, namespace: 'meta' });
  const country = await fetchPublicEntity<{ name: string }>(`/public/catalog/countries/${slug}`);
  const title = country?.name ?? t('title');
  const description = country ? t('destinationFallback', { country: country.name }) : t('homeDescription');
  return publicMetadata({ locale, path: `/destinations/${slug}`, title, description });
}

export default async function Page({ params }: { params: Promise<{ locale: string; slug: string }> }) {
  const { locale, slug } = await params;
  setRequestLocale(locale);
  return <DestinationDetailPage slug={slug} />;
}
