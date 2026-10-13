import { setRequestLocale } from 'next-intl/server';
import { CashboxPage } from '@/features/cashbox/cashbox-page';

export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  setRequestLocale((await params).locale);
  return <CashboxPage />;
}
