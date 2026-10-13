import { setRequestLocale } from 'next-intl/server';
import { PartnerCandidateDetailPage } from '@/features/partner-portal/partner-candidate-detail-page';

export default async function Page({ params }: { params: Promise<{ locale: string; id: string }> }) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  return <PartnerCandidateDetailPage candidateId={id} />;
}
