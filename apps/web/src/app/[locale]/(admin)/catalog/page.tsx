import { setRequestLocale } from 'next-intl/server';
import { CatalogPage } from '@/features/catalog/catalog-page';

export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  setRequestLocale((await params).locale);
  return <CatalogPage />;
}
