import { setRequestLocale } from 'next-intl/server';
import { SiteAdminPage } from '@/features/site-admin/site-admin-page';

export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  setRequestLocale((await params).locale);
  return <SiteAdminPage />;
}
