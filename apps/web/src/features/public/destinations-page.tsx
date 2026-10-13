'use client';

import { useQuery } from '@tanstack/react-query';
import { Compass } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { EmptyState } from '@/components/empty-state';
import { api } from '@/lib/api';
import type { Country } from '@/lib/types';
import { DestinationCard, Reveal, RevealGroup, RevealItem } from './design-system';
import { PublicShell } from './public-shell';

export function DestinationsPage() {
  const t = useTranslations('public');
  const tc = useTranslations('common');
  const query = useQuery({ queryKey: ['public', 'countries'], queryFn: () => api<Country[]>('/public/catalog/countries', { auth: false }) });

  return (
    <PublicShell>
      <section className="mx-auto max-w-6xl px-6 py-14">
        <Reveal className="mx-auto max-w-2xl text-center">
          <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
            <Compass className="h-5 w-5" aria-hidden />
          </span>
          <h1 className="mt-3 font-poppins text-3xl font-bold text-navy">{t('destinationsTitle')}</h1>
          <p className="mt-2 text-muted-foreground">{t('destinationsSubtitle')}</p>
        </Reveal>

        {query.isLoading ? (
          <p role="status" className="mt-10 text-center text-sm text-muted-foreground">{tc('loading')}</p>
        ) : !query.data?.length ? (
          <div className="mt-10"><EmptyState title={t('emptyDestinations')} /></div>
        ) : (
          <RevealGroup className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {query.data.map((c) => (
              <RevealItem key={c.id}>
                <DestinationCard name={c.name} slug={c.slug} flag={c.flagEmoji} tagline={c.description ?? t('destinationCardFallback')} />
              </RevealItem>
            ))}
          </RevealGroup>
        )}
      </section>
    </PublicShell>
  );
}
