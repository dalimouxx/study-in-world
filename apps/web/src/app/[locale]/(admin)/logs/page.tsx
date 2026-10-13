import { setRequestLocale } from 'next-intl/server';
import { LogsPage } from '@/features/audit/logs-page';

export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  setRequestLocale((await params).locale);
  return <LogsPage />;
}
