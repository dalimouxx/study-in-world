import { setRequestLocale } from 'next-intl/server';
import { ExpensesPage } from '@/features/expenses/expenses-page';

export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  setRequestLocale((await params).locale);
  return <ExpensesPage />;
}
