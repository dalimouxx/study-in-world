'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { AuthShell } from '@/components/auth-shell';
import { Button } from '@/components/ui/button';
import { Field, Input } from '@/components/ui/form';
import { Link, useRouter } from '@/i18n/navigation';
import { useErrorMessage } from '@/lib/use-error-message';
import { useAuth } from './auth-context';

export function LoginForm() {
  const t = useTranslations('auth');
  const tc = useTranslations('common');
  const errorMessage = useErrorMessage();
  const router = useRouter();
  const { login, status, user } = useAuth();
  const [formError, setFormError] = useState<string | null>(null);

  const schema = z.object({
    email: z.string().min(1, tc('required')).email(t('emailInvalid')),
    password: z.string().min(1, tc('required')),
  });
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<z.infer<typeof schema>>({ resolver: zodResolver(schema) });

  useEffect(() => {
    if (status === 'authenticated') router.replace(user?.mustChangePassword ? '/account' : '/dashboard');
  }, [status, user, router]);

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    try {
      await login(values.email, values.password);
    } catch (err) {
      setFormError(errorMessage(err));
    }
  });

  return (
    <AuthShell>
      <h1 className="text-2xl font-semibold tracking-tight">{t('loginTitle')}</h1>
      <p className="mt-1 text-sm text-muted-foreground">{t('loginSubtitle')}</p>

      <form onSubmit={onSubmit} noValidate className="mt-8 space-y-4">
        <Field label={t('email')} htmlFor="email" error={errors.email?.message}>
          <Input id="email" type="email" autoComplete="username" dir="ltr" aria-invalid={!!errors.email} {...register('email')} />
        </Field>
        <Field label={t('password')} htmlFor="password" error={errors.password?.message}>
          <Input id="password" type="password" autoComplete="current-password" dir="ltr" aria-invalid={!!errors.password} {...register('password')} />
        </Field>
        {formError && (
          <p role="alert" className="rounded-md bg-destructive-soft px-3 py-2 text-sm text-destructive">
            {formError}
          </p>
        )}
        <Button type="submit" className="w-full" loading={isSubmitting}>
          {t('signIn')}
        </Button>
      </form>

      <Link href="/forgot-password" className="mt-6 text-sm text-primary underline-offset-4 hover:underline">
        {t('forgotLink')}
      </Link>
    </AuthShell>
  );
}
