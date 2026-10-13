import { setRequestLocale } from 'next-intl/server';
import { PartnerCandidatesPage } from '@/features/partner-portal/partner-candidates-page';

export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  setRequestLocale((await params).locale);
  return <PartnerCandidatesPage />;
}
