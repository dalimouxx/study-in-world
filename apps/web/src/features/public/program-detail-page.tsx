'use client';

import { useQuery } from '@tanstack/react-query';
import { useLocale, useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { api } from '@/lib/api';
import type { Program } from '@/lib/types';
import { useErrorMessage } from '@/lib/use-error-message';
import { formatDateTime } from '@/lib/utils';
import { countryAccentColor, MorphBlob, Reveal, RevealGroup, RevealItem, StudyWorldButton } from './design-system';
import { PublicShell } from './public-shell';

export function ProgramDetailPage({ slug }: { slug: string }) {
  const t = useTranslations('public');
  const tc = useTranslations('common');
  const locale = useLocale();
  const errorMessage = useErrorMessage();
  const query = useQuery({ queryKey: ['public', 'programs', slug], queryFn: () => api<Program>(`/public/catalog/programs/${slug}`, { auth: false }) });

  if (query.isLoading) return <PublicShell><p role="status" className="px-6 py-14 text-center text-sm text-muted-foreground">{tc('loading')}</p></PublicShell>;
  if (query.isError || !query.data) return <PublicShell><p role="alert" className="px-6 py-14 text-center text-sm text-destructive">{errorMessage(query.error)}</p></PublicShell>;

  const p = query.data;
  const u = p.university;
  const accent = u?.country ? countryAccentColor(u.country.name) : 'hsl(var(--primary))';

  return (
    <PublicShell>
      <section className="mx-auto max-w-6xl px-3 pt-6 sm:px-6">
        <Reveal>
          <div className="pop relative overflow-hidden rounded-tile bg-primary px-6 py-10 text-white sm:px-10">
            <MorphBlob className="-bottom-24 -end-16 h-72 w-72" />
            <p className="relative text-sm font-semibold text-white/85">
              {u?.country && <Link href={`/destinations/${u.country.slug}`} className="underline-offset-4 hover:underline">{u.country.flagEmoji} {u.country.name}</Link>}
              {u && <> · <Link href={`/universities/${u.slug}`} className="underline-offset-4 hover:underline">{u.name}</Link> · {u.city}</>}
            </p>
            <h1 className="relative mt-2 font-display text-4xl font-extrabold leading-[1.05] tracking-tight sm:text-5xl">{p.name}</h1>
            <div className="relative mt-4 flex flex-wrap gap-2">
              {[t(`levels.${p.level}`), p.domain, p.language].filter(Boolean).map((tag) => (
                <span key={tag} className="pop rounded-full bg-white px-3 py-1 text-xs font-extrabold text-ink">{tag}</span>
              ))}
            </div>
          </div>
        </Reveal>
      </section>

      <section className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
        <RevealGroup className="grid gap-3 sm:grid-cols-3">
          {([
            [t('fees'), p.tuitionFees ? `${p.tuitionFees} ${p.currency}` : '–'],
            [t('durationMonths'), p.durationMonths ?? '–'],
            [t('deadline'), p.deadline ? formatDateTime(p.deadline, locale) : '–'],
          ] as const).map(([label, value]) => (
            <RevealItem key={label}>
              <div className="pop h-full rounded-tile bg-card p-5">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
                <p className="mt-1 font-display text-2xl font-extrabold text-primary">{value}</p>
              </div>
            </RevealItem>
          ))}
        </RevealGroup>

        {p.description && (
          <Reveal delay={0.15} className="pop-soft mt-6 rounded-tile bg-card p-5">
            <h2 className="font-display font-extrabold text-ink">{t('description')}</h2>
            <p className="mt-1 whitespace-pre-line text-sm text-muted-foreground">{p.description}</p>
          </Reveal>
        )}
        {p.academicConditions && (
          <Reveal className="pop-soft mt-4 rounded-tile bg-card p-5">
            <h2 className="font-display font-extrabold text-ink">{t('academicConditions')}</h2>
            <p className="mt-1 whitespace-pre-line text-sm text-muted-foreground">{p.academicConditions}</p>
          </Reveal>
        )}
        {(p.minIelts || p.minToefl) && (
          <Reveal className="pop-soft mt-4 rounded-tile bg-card p-5">
            <h2 className="font-display font-extrabold text-ink">{t('languageRequirements')}</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {p.minIelts ? `IELTS ≥ ${p.minIelts}` : ''}{p.minIelts && p.minToefl ? ' · ' : ''}{p.minToefl ? `TOEFL ≥ ${p.minToefl}` : ''}
            </p>
          </Reveal>
        )}

        <Reveal className="mt-12 text-center">
          <StudyWorldButton href="/#contact" accent={accent}>{t('askAboutProgram')}</StudyWorldButton>
        </Reveal>
      </section>
    </PublicShell>
  );
}
