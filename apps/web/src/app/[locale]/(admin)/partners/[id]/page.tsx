import { setRequestLocale } from 'next-intl/server';
import { PartnerDetailPage } from '@/features/partners/partner-detail-page';

export default async function Page({ params }: { params: Promise<{ locale: string; id: string }> }) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  return <PartnerDetailPage partnerId={id} />;
}
