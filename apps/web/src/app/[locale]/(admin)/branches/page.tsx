import { setRequestLocale } from 'next-intl/server';
import { BranchesPage } from '@/features/branches/branches-page';

export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  setRequestLocale((await params).locale);
  return <BranchesPage />;
}
