import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { DestinationsPage } from '@/features/public/destinations-page';
import { publicMetadata } from '@/lib/seo';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const [t, tp] = await Promise.all([getTranslations({ locale, namespace: 'meta' }), getTranslations({ locale, namespace: 'public' })]);
  return publicMetadata({ locale, path: '/destinations', title: tp('destinationsTitle'), description: t('destinationsDescription') });
}

export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  setRequestLocale((await params).locale);
  return <DestinationsPage />;
}
