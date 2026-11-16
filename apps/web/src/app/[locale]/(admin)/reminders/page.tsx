import { setRequestLocale } from 'next-intl/server';
import { RemindersPage } from '@/features/reminders/reminders-page';

export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  setRequestLocale((await params).locale);
  return <RemindersPage />;
}
