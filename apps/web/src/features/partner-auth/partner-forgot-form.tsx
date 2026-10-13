'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { AuthShell } from '@/components/auth-shell';
import { Button } from '@/components/ui/button';
import { Field, Input } from '@/components/ui/form';
import { Link } from '@/i18n/navigation';
import { partnerPortalApi } from '@/lib/partner-portal-api';
import { useErrorMessage } from '@/lib/use-error-message';

export function PartnerForgotForm() {
  const t = useTranslations('auth');
  const tc = useTranslations('common');
  const errorMessage = useErrorMessage();
  const [sent, setSent] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const schema = z.object({ email: z.string().min(1, tc('required')).email(t('emailInvalid')) });
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<z.infer<typeof schema>>({ resolver: zodResolver(schema) });

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    try {
      await partnerPortalApi('/partner-portal/auth/forgot-password', { method: 'POST', body: values, auth: false });
      setSent(true);
    } catch (err) {
      setFormError(errorMessage(err));
    }
  });

  return (
    <AuthShell>
      <h1 className="text-2xl font-semibold tracking-tight">{t('forgotTitle')}</h1>
      {sent ? (
        <p role="status" className="mt-4 rounded-md bg-success-soft px-3 py-3 text-sm text-success">{t('forgotSent')}</p>
      ) : (
        <>
          <p className="mt-1 text-sm text-muted-foreground">{t('forgotSubtitle')}</p>
          <form onSubmit={onSubmit} noValidate className="mt-8 space-y-4">
            <Field label={t('email')} htmlFor="email" error={errors.email?.message}>
              <Input id="email" type="email" autoComplete="username" dir="ltr" aria-invalid={!!errors.email} {...register('email')} />
            </Field>
            {formError && <p role="alert" className="rounded-md bg-destructive-soft px-3 py-2 text-sm text-destructive">{formError}</p>}
            <Button type="submit" className="w-full" loading={isSubmitting}>{t('sendLink')}</Button>
          </form>
        </>
      )}
      <Link href="/partner-portal/login" className="mt-6 text-sm text-primary underline-offset-4 hover:underline">{t('backToLogin')}</Link>
    </AuthShell>
  );
}
