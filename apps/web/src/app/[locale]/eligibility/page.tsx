import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { EligibilitySimulatorPage } from '@/features/public/eligibility-simulator-page';
import { publicMetadata } from '@/lib/seo';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const [t, tp] = await Promise.all([getTranslations({ locale, namespace: 'meta' }), getTranslations({ locale, namespace: 'public' })]);
  return publicMetadata({ locale, path: '/eligibility', title: tp('eligibilityTitle'), description: t('eligibilityDescription') });
}

export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  setRequestLocale((await params).locale);
  return <EligibilitySimulatorPage />;
}
