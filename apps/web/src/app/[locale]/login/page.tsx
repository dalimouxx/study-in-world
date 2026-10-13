import { setRequestLocale } from 'next-intl/server';
import { LoginForm } from '@/features/auth/login-form';

export default async function LoginPage({ params }: { params: Promise<{ locale: string }> }) {
  setRequestLocale((await params).locale);
  return <LoginForm />;
}
