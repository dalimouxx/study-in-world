import { setRequestLocale } from 'next-intl/server';
import { PlatformAdminPage } from '@/features/platform-admin/platform-admin-page';

export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  setRequestLocale((await params).locale);
  return <PlatformAdminPage />;
}
