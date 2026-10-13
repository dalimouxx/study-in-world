import { setRequestLocale } from 'next-intl/server';
import { AutomationPage } from '@/features/automation/automation-page';

export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  setRequestLocale((await params).locale);
  return <AutomationPage />;
}
