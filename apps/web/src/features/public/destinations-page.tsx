'use client';

import { useQuery } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { EmptyState } from '@/components/empty-state';
import { api } from '@/lib/api';
import type { Country } from '@/lib/types';
import { DestinationCard, RevealGroup, RevealItem, PublicPageHero } from './design-system';
import { PublicShell } from './public-shell';

export function DestinationsPage() {
  const t = useTranslations('public');
  const tc = useTranslations('common');
  const query = useQuery({ queryKey: ['public', 'countries'], queryFn: () => api<Country[]>('/public/catalog/countries', { auth: false }) });

  return (
    <PublicShell>
      <PublicPageHero title={t('destinationsTitle')} subtitle={t('destinationsSubtitle')} />
      <section className="mx-auto max-w-6xl px-4 py-10 sm:px-6">

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
