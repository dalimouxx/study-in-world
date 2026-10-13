import { setRequestLocale } from 'next-intl/server';
import { PartnersPage } from '@/features/partners/partners-page';

export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  setRequestLocale((await params).locale);
  return <PartnersPage />;
}
