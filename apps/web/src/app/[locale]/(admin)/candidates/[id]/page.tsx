import { setRequestLocale } from 'next-intl/server';
import { CandidateDetailPage } from '@/features/candidates/candidate-detail-page';

export default async function Page({ params }: { params: Promise<{ locale: string; id: string }> }) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  return <CandidateDetailPage candidateId={id} />;
}
