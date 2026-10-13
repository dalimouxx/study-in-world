'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslations } from 'next-intl';
import { useSearchParams } from 'next/navigation';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { AuthShell } from '@/components/auth-shell';
import { Button } from '@/components/ui/button';
import { Field, Input } from '@/components/ui/form';
import { Link } from '@/i18n/navigation';
import { api } from '@/lib/api';
import { passwordSchema } from '@/lib/schemas';
import { useErrorMessage } from '@/lib/use-error-message';

export function ResetForm() {
  const t = useTranslations('auth');
  const tc = useTranslations('common');
  const errorMessage = useErrorMessage();
  const token = useSearchParams().get('token') ?? '';
  const [done, setDone] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const schema = z
    .object({ newPassword: passwordSchema(t), confirm: z.string().min(1, tc('required')) })
    .refine((v) => v.newPassword === v.confirm, { path: ['confirm'], message: t('passwordMismatch') });
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<z.infer<typeof schema>>({ resolver: zodResolver(schema) });

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    try {
      await api('/auth/reset-password', { method: 'POST', body: { token, newPassword: values.newPassword }, auth: false });
      setDone(true);
    } catch (err) {
      setFormError(errorMessage(err));
    }
  });

  return (
    <AuthShell>
      <h1 className="text-2xl font-semibold tracking-tight">{t('resetTitle')}</h1>
      {done ? (
        <p role="status" className="mt-4 rounded-md bg-success-soft px-3 py-3 text-sm text-success">
          {t('resetDone')}
        </p>
      ) : !token ? (
        <p role="alert" className="mt-4 rounded-md bg-destructive-soft px-3 py-3 text-sm text-destructive">
          {t('resetMissingToken')}
        </p>
      ) : (
        <form onSubmit={onSubmit} noValidate className="mt-8 space-y-4">
          <Field label={t('newPassword')} htmlFor="newPassword" hint={t('passwordRule')} error={errors.newPassword?.message}>
            <Input id="newPassword" type="password" autoComplete="new-password" dir="ltr" aria-invalid={!!errors.newPassword} {...register('newPassword')} />
          </Field>
          <Field label={t('confirmPassword')} htmlFor="confirm" error={errors.confirm?.message}>
            <Input id="confirm" type="password" autoComplete="new-password" dir="ltr" aria-invalid={!!errors.confirm} {...register('confirm')} />
          </Field>
          {formError && (
            <p role="alert" className="rounded-md bg-destructive-soft px-3 py-2 text-sm text-destructive">
              {formError}
            </p>
          )}
          <Button type="submit" className="w-full" loading={isSubmitting}>
            {t('resetSubmit')}
          </Button>
        </form>
      )}
      <Link href="/login" className="mt-6 text-sm text-primary underline-offset-4 hover:underline">
        {t('backToLogin')}
      </Link>
    </AuthShell>
  );
}
