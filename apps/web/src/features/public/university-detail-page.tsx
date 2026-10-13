'use client';

import { useQuery } from '@tanstack/react-query';
import { Landmark } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { EmptyState } from '@/components/empty-state';
import { Link } from '@/i18n/navigation';
import { api } from '@/lib/api';
import type { University } from '@/lib/types';
import { useErrorMessage } from '@/lib/use-error-message';
import { countryAccentColor, FlagBadge, Reveal, RevealGroup, RevealItem } from './design-system';
import { PublicShell } from './public-shell';

export function UniversityDetailPage({ slug }: { slug: string }) {
  const t = useTranslations('public');
  const tc = useTranslations('common');
  const errorMessage = useErrorMessage();
  const query = useQuery({ queryKey: ['public', 'universities', slug], queryFn: () => api<University>(`/public/catalog/universities/${slug}`, { auth: false }) });

  if (query.isLoading) return <PublicShell><p role="status" className="px-6 py-14 text-center text-sm text-muted-foreground">{tc('loading')}</p></PublicShell>;
  if (query.isError || !query.data) return <PublicShell><p role="alert" className="px-6 py-14 text-center text-sm text-destructive">{errorMessage(query.error)}</p></PublicShell>;

  const u = query.data;
  const accent = u.country ? countryAccentColor(u.country.name) : 'hsl(var(--sw-sky))';

  return (
    <PublicShell>
      <section className="relative overflow-hidden py-14" style={{ background: `linear-gradient(135deg, hsl(var(--navy)), ${accent})` }}>
        <Landmark className="absolute -bottom-6 -right-6 h-40 w-40 text-white/10" aria-hidden />
        <Reveal className="relative z-10 mx-auto max-w-4xl px-6">
          {u.country && <FlagBadge flag={u.country.flagEmoji} name={`${u.country.name} · ${u.city}`} />}
          <h1 className="mt-3 font-poppins text-3xl font-bold text-white sm:text-4xl">{u.name}</h1>
        </Reveal>
      </section>

      <section className="mx-auto max-w-4xl px-6 py-12">
        {u.description && <Reveal><p className="text-lg text-muted-foreground">{u.description}</p></Reveal>}

        <div className="mt-10">
          <Reveal><h2 className="mb-4 font-poppins text-xl font-bold text-navy">{t('programsAt', { university: u.name })}</h2></Reveal>
          {!u.programs?.length ? (
            <EmptyState title={t('emptyProgramsAt')} />
          ) : (
            <RevealGroup className="grid gap-3 sm:grid-cols-2">
              {u.programs.map((p) => (
                <RevealItem key={p.id}>
                  <Link href={`/programs/${p.slug}`} className="block rounded-organic border border-primary/10 bg-white p-4 shadow-sm transition-shadow hover:shadow-md">
                    <p className="font-medium text-navy">{p.name}</p>
                    <p className="text-sm text-muted-foreground">{t(`levels.${p.level}`)}{p.tuitionFees ? ` · ${p.tuitionFees} ${p.currency}` : ''}</p>
                  </Link>
                </RevealItem>
              ))}
            </RevealGroup>
          )}
        </div>
      </section>
    </PublicShell>
  );
}
