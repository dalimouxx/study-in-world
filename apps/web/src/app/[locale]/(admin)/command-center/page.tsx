import { setRequestLocale } from 'next-intl/server';
import { CommandCenterPage } from '@/features/command-center/command-center-page';

export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  setRequestLocale((await params).locale);
  return <CommandCenterPage />;
}
