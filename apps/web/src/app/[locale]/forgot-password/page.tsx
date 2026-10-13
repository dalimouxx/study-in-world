import { setRequestLocale } from 'next-intl/server';
import { ForgotForm } from '@/features/auth/forgot-form';

export default async function ForgotPage({ params }: { params: Promise<{ locale: string }> }) {
  setRequestLocale((await params).locale);
  return <ForgotForm />;
}
