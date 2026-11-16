import { setRequestLocale } from 'next-intl/server';
import { TemplatesPage } from '@/features/message-templates/templates-page';

export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  setRequestLocale((await params).locale);
  return <TemplatesPage />;
}
