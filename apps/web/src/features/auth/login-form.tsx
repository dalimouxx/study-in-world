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
import { ApiError } from '@/lib/api';
import { useErrorMessage } from '@/lib/use-error-message';
import { useAuth } from './auth-context';

export function LoginForm() {
  const t = useTranslations('auth');
  const tc = useTranslations('common');
  const errorMessage = useErrorMessage();
  const router = useRouter();
  const { login, verifyTwoFactor, status, user } = useAuth();
  const [formError, setFormError] = useState<string | null>(null);
  // Double authentification : après le mot de passe, on demande le code (jeton d'étape valable 5 minutes).
  const [twoFactorToken, setTwoFactorToken] = useState<string | null>(null);

  const schema = z.object({
    email: z.string().min(1, tc('required')).email(t('emailInvalid')),
    password: z.string().min(1, tc('required')),
  });
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<z.infer<typeof schema>>({ resolver: zodResolver(schema) });

  const codeForm = useForm<{ code: string }>();

  useEffect(() => {
    if (status === 'authenticated') router.replace(user?.mustChangePassword || user?.mustSetupTwoFactor ? '/account' : '/dashboard');
  }, [status, user, router]);

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    try {
      const result = await login(values.email, values.password);
      if ('twoFactorToken' in result) setTwoFactorToken(result.twoFactorToken);
    } catch (err) {
      setFormError(errorMessage(err));
    }
  });

  const onCode = codeForm.handleSubmit(async ({ code }) => {
    if (!twoFactorToken) return;
    setFormError(null);
    try {
      await verifyTwoFactor(twoFactorToken, code);
    } catch (err) {
      setFormError(errorMessage(err));
      codeForm.reset({ code: '' });
      // Étape expirée (5 minutes) ou trop de mauvais codes : retour à l'e-mail et au mot de passe, avec le message.
      if (err instanceof ApiError && (err.code === 'TWO_FACTOR_EXPIRED' || err.code === 'ACCOUNT_LOCKED')) setTwoFactorToken(null);
    }
  });

  if (twoFactorToken) {
    return (
      <AuthShell>
        <h1 className="text-2xl font-semibold tracking-tight">{t('twoFactorTitle')}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t('twoFactorSubtitle')}</p>
        {/* key : nouveau formulaire (sinon React réutilise le champ e-mail et son contenu pour le code). */}
        <form key="code-step" onSubmit={onCode} noValidate className="mt-8 space-y-4">
          <Field label={t('twoFactorCode')} htmlFor="code" hint={t('twoFactorRecoveryHint')} error={codeForm.formState.errors.code?.message}>
            <Input
              id="code"
              dir="ltr"
              inputMode="text"
              autoComplete="one-time-code"
              autoFocus
              maxLength={20}
              className="text-center font-mono text-lg tracking-[0.3em]"
              aria-invalid={!!codeForm.formState.errors.code}
              {...codeForm.register('code', { required: tc('required'), minLength: { value: 6, message: t('twoFactorCodeInvalid') } })}
            />
          </Field>
          {formError && (
            <p role="alert" className="rounded-md bg-destructive-soft px-3 py-2 text-sm text-destructive">
              {formError}
            </p>
          )}
          <Button type="submit" className="w-full" loading={codeForm.formState.isSubmitting}>
            {t('twoFactorVerify')}
          </Button>
        </form>
        <button type="button" className="mt-6 text-sm text-primary underline-offset-4 hover:underline" onClick={() => { setTwoFactorToken(null); setFormError(null); }}>
          {t('twoFactorBack')}
        </button>
      </AuthShell>
    );
  }

  return (
    <AuthShell>
      <h1 className="text-2xl font-semibold tracking-tight">{t('loginTitle')}</h1>
      <p className="mt-1 text-sm text-muted-foreground">{t('loginSubtitle')}</p>

      <form key="credentials-step" onSubmit={onSubmit} noValidate className="mt-8 space-y-4">
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
