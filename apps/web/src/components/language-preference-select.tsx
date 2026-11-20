'use client';

import { useTranslations } from 'next-intl';
import { forwardRef, type SelectHTMLAttributes } from 'react';
import { Select } from '@/components/ui/form';

/** Langue dans laquelle partent les messages au candidat ou au prospect (relances, modèles WhatsApp/e-mail). */
export const LanguagePreferenceSelect = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(function LanguagePreferenceSelect(props, ref) {
  const t = useTranslations('common');
  return (
    <Select ref={ref} {...props}>
      <option value="fr">{t('languageFr')}</option>
      <option value="ar">{t('languageAr')}</option>
    </Select>
  );
});
