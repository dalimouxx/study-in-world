'use client';

import { useQuery } from '@tanstack/react-query';
import { useLocale, useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { api } from '@/lib/api';
import type { Program } from '@/lib/types';
import { useErrorMessage } from '@/lib/use-error-message';
import { formatDateTime } from '@/lib/utils';
import { countryAccentColor, Reveal, StudyWorldButton } from './design-system';
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
      <section className="mx-auto max-w-3xl px-6 py-14">
        <Reveal>
          <p className="text-sm text-muted-foreground">
            {u?.country && <Link href={`/destinations/${u.country.slug}`} className="hover:text-primary">{u.country.flagEmoji} {u.country.name}</Link>}
            {u && <> · <Link href={`/universities/${u.slug}`} className="hover:text-primary">{u.name}</Link> · {u.city}</>}
          </p>
          <h1 className="mt-1 font-poppins text-3xl font-bold text-navy">{p.name}</h1>
          <p className="mt-1 text-muted-foreground">{t(`levels.${p.level}`)}{p.domain ? ` · ${p.domain}` : ''}{p.language ? ` · ${p.language}` : ''}</p>
        </Reveal>

        <Reveal delay={0.1} className="mt-6 grid gap-4 rounded-organic border border-primary/10 bg-white p-5 shadow-sm sm:grid-cols-3">
          <div><p className="text-xs text-muted-foreground">{t('fees')}</p><p className="font-semibold text-navy">{p.tuitionFees ? `${p.tuitionFees} ${p.currency}` : '–'}</p></div>
          <div><p className="text-xs text-muted-foreground">{t('durationMonths')}</p><p className="font-semibold text-navy">{p.durationMonths ?? '–'}</p></div>
          <div><p className="text-xs text-muted-foreground">{t('deadline')}</p><p className="font-semibold text-navy">{p.deadline ? formatDateTime(p.deadline, locale) : '–'}</p></div>
        </Reveal>

        {p.description && (
          <Reveal delay={0.15} className="mt-6">
            <h2 className="font-poppins font-semibold text-navy">{t('description')}</h2>
            <p className="mt-1 whitespace-pre-line text-sm text-muted-foreground">{p.description}</p>
          </Reveal>
        )}
        {p.academicConditions && (
          <Reveal className="mt-6">
            <h2 className="font-poppins font-semibold text-navy">{t('academicConditions')}</h2>
            <p className="mt-1 whitespace-pre-line text-sm text-muted-foreground">{p.academicConditions}</p>
          </Reveal>
        )}
        {(p.minIelts || p.minToefl) && (
          <Reveal className="mt-6">
            <h2 className="font-poppins font-semibold text-navy">{t('languageRequirements')}</h2>
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
