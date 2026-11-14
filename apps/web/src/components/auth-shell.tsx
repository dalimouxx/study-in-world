'use client';

import { useTranslations } from 'next-intl';
import type { ReactNode } from 'react';
import { useAgency } from '@/features/auth/use-agency';
import { MorphBlob } from '@/features/public/design-system';
import { Card } from './ui/card';
import { LanguageSwitcher } from './language-switcher';

/** Pages de connexion (employés, candidats, partenaires) : grand bloc bleu animé + formulaire dans un bloc Pop. */
export function AuthShell({ children }: { children: ReactNode }) {
  const t = useTranslations('auth');
  const agency = useAgency();
  const name = agency.data?.name ?? t('brandFallback');
  const journey = t.raw('journey') as string[];

  return (
    <div data-surface="app" className="grid min-h-screen gap-4 bg-background p-3 sm:p-4 lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
      <aside className="relative hidden flex-col justify-between overflow-hidden rounded-tile border-pop border-ink bg-primary px-12 py-12 text-white shadow-pop lg:flex">
        <MorphBlob className="-bottom-24 -end-20 h-96 w-96" />
        <MorphBlob className="end-40 top-24 h-40 w-40 [animation-duration:11s]" />
        <p className="relative font-display text-xl font-extrabold tracking-tight">{name}</p>
        <div className="relative">
          <p className="mb-8 max-w-sm text-xl font-medium leading-snug text-white/90">{t('tagline')}</p>
          <ol className="space-y-2" aria-label={t('journeyLabel')}>
            {journey.map((d) => (
              <li key={d} className="flex items-center gap-4 font-display text-4xl font-extrabold leading-tight tracking-tight">
                <span aria-hidden className="h-3 w-3 shrink-0 rounded-[3px] border-[1.5px] border-ink bg-white" />
                {d}
              </li>
            ))}
          </ol>
        </div>
        <p className="relative text-sm text-white/75">{agency.data?.footerText ?? ''}</p>
      </aside>

      <main className="flex flex-col px-3 py-3 sm:px-8">
        <div className="flex items-center justify-between gap-3">
          <p className="font-display text-lg font-extrabold tracking-tight text-ink lg:invisible">{name}</p>
          <LanguageSwitcher />
        </div>
        <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center py-10">
          <Card variant="pop" className="p-6 sm:p-8">{children}</Card>
        </div>
      </main>
    </div>
  );
}
