import { setRequestLocale } from 'next-intl/server';
import { PortalDocumentsPage } from '@/features/portal/portal-documents-page';

export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  setRequestLocale((await params).locale);
  return <PortalDocumentsPage />;
}
