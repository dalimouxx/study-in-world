'use client';

import { useTranslations } from 'next-intl';
import type { ReactNode } from 'react';
import { useAgency } from '@/features/auth/use-agency';
import { LanguageSwitcher } from './language-switcher';

export function AuthShell({ children }: { children: ReactNode }) {
  const t = useTranslations('auth');
  const agency = useAgency();
  const name = agency.data?.name ?? t('brandFallback');
  const journey = t.raw('journey') as string[];

  return (
    <div className="grid min-h-screen lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
      <aside className="relative hidden flex-col justify-between overflow-hidden bg-navy px-12 py-12 text-white lg:flex">
        <p className="text-lg font-semibold tracking-tight">{name}</p>
        <div>
          <p className="mb-8 max-w-sm text-2xl font-light leading-snug text-white/85">{t('tagline')}</p>
          <ol className="relative space-y-3 border-s border-white/25 ps-8" aria-label={t('journeyLabel')}>
            {journey.map((d) => (
              <li key={d} className="relative text-4xl font-light leading-tight">
                <span aria-hidden className="absolute -start-[37px] top-1/2 h-2.5 w-2.5 -translate-y-1/2 rounded-full bg-accent" />
                {d}
              </li>
            ))}
          </ol>
        </div>
        <p className="text-sm text-white/60">{agency.data?.footerText ?? ''}</p>
      </aside>

      <main className="flex flex-col px-6 py-6 sm:px-12">
        <div className="flex items-center justify-between">
          <p className="text-base font-semibold lg:invisible">{name}</p>
          <LanguageSwitcher />
        </div>
        <div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center py-10">{children}</div>
      </main>
    </div>
  );
}
