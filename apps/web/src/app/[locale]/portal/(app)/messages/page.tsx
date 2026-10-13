import { setRequestLocale } from 'next-intl/server';
import { PortalMessagesPage } from '@/features/portal/portal-messages-page';

export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  setRequestLocale((await params).locale);
  return <PortalMessagesPage />;
}
