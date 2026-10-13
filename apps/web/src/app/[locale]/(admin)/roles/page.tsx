import { setRequestLocale } from 'next-intl/server';
import { RolesPage } from '@/features/roles/roles-page';

export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  setRequestLocale((await params).locale);
  return <RolesPage />;
}
