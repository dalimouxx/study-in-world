'use client';

import { useTranslations } from 'next-intl';
import { ApiError } from './api';

/** Traduit une erreur API grâce à son code stable ; retombe sur un message générique. */
export function useErrorMessage() {
  const t = useTranslations('errors');
  return (err: unknown): string => {
    if (err instanceof ApiError) {
      if (err.code && t.has(err.code)) return t(err.code);
      if (err.status === 0) return t('NETWORK');
      if (err.status === 400) return t('VALIDATION');
      if (err.status === 403) return t('FORBIDDEN');
    }
    return t('GENERIC');
  };
}
