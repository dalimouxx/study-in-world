import { setRequestLocale } from 'next-intl/server';
import { SettingsPage } from '@/features/settings/settings-page';

export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  setRequestLocale((await params).locale);
  return <SettingsPage />;
}
