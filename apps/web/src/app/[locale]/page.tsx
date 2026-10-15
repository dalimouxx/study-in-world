import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { PublicLandingPage } from '@/features/public/public-landing-page';
import { fetchPublicEntity, publicMetadata } from '@/lib/seo';
import type { LandingPagePublicData } from '@/lib/types';

/** Titre/description éditables par le Super Admin (page « Page d'accueil ») ; repli sur les textes par défaut si vides. */
export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'meta' });
  const landing = await fetchPublicEntity<LandingPagePublicData>('/public/landing-page');
  const content = landing?.content;
  const title = (locale === 'ar' ? content?.seoTitleAr : content?.seoTitleFr) || content?.seoTitleFr || t('title');
  const description = (locale === 'ar' ? content?.seoDescriptionAr : content?.seoDescriptionFr) || content?.seoDescriptionFr || t('homeDescription');
  return publicMetadata({ locale, path: '', title, description });
}

export default async function Home({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <PublicLandingPage />;
}
