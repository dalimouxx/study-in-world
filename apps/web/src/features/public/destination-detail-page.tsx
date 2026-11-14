'use client';

import { useQuery } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { api } from '@/lib/api';
import type { Country } from '@/lib/types';
import { useErrorMessage } from '@/lib/use-error-message';
import { countryAccentColor, destinationHeroImage, FlagBadge, MorphBlob, Reveal, RevealGroup, RevealItem, StudyWorldButton } from './design-system';
import { PublicShell } from './public-shell';

const SECTIONS = ['advantages', 'costOfLiving', 'admissionConditions', 'visaInfo', 'housingInfo', 'studentWorkInfo'] as const;

export function DestinationDetailPage({ slug }: { slug: string }) {
  const t = useTranslations('public');
  const tc = useTranslations('common');
  const errorMessage = useErrorMessage();
  const query = useQuery({ queryKey: ['public', 'countries', slug], queryFn: () => api<Country>(`/public/catalog/countries/${slug}`, { auth: false }) });

  if (query.isLoading) return <PublicShell><p role="status" className="px-6 py-14 text-center text-sm text-muted-foreground">{tc('loading')}</p></PublicShell>;
  if (query.isError || !query.data) return <PublicShell><p role="alert" className="px-6 py-14 text-center text-sm text-destructive">{errorMessage(query.error)}</p></PublicShell>;

  const c = query.data;
  const hero = destinationHeroImage(c.name);
  const accent = countryAccentColor(c.name);

  return (
    <PublicShell>
      {/* HERO */}
      <section className="mx-auto max-w-6xl px-3 pt-6 sm:px-6">
        <div className="pop relative flex min-h-[320px] items-end overflow-hidden rounded-tile">
        {hero ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={hero} alt="" className="absolute inset-0 h-full w-full object-cover object-top" />
        ) : (
          <div className="absolute inset-0 overflow-hidden bg-primary">
            <MorphBlob className="-bottom-24 -end-16 h-80 w-80" />
            <MorphBlob className="end-1/3 top-8 h-28 w-28 [animation-duration:11s]" />
            {c.flagEmoji && <span aria-hidden className="absolute end-10 top-1/2 -translate-y-1/2 text-[120px] leading-none sm:text-[160px]">{c.flagEmoji}</span>}
          </div>
        )}
        {hero && <div className="absolute inset-0 bg-gradient-to-t from-ink/80 via-ink/10 to-transparent" aria-hidden />}
        <Reveal className="relative z-10 px-6 pb-8 sm:px-10">
          <FlagBadge flag={c.flagEmoji} name={c.name} />
          <h1 className="mt-3 font-display text-4xl font-extrabold tracking-tight text-white sm:text-6xl">{c.name}</h1>
        </Reveal>
        </div>
      </section>

      <section className="mx-auto max-w-4xl px-6 py-12">
        {c.description && <Reveal><p className="text-lg text-muted-foreground">{c.description}</p></Reveal>}

        <RevealGroup className="mt-8 grid gap-4 sm:grid-cols-2">
          {SECTIONS.filter((k) => c[k]).map((k) => (
            <RevealItem key={k}>
              <div className="h-full pop rounded-tile bg-card p-5">
                <h2 className="font-display font-extrabold text-ink">{t(`destinationSections.${k}`)}</h2>
                <p className="mt-1.5 whitespace-pre-line text-sm text-muted-foreground">{c[k]}</p>
              </div>
            </RevealItem>
          ))}
        </RevealGroup>

        {!!c.universities?.length && (
          <div className="mt-12">
            <Reveal><h2 className="mb-4 font-display text-xl font-extrabold tracking-tight text-ink">{t('universitiesIn', { country: c.name })}</h2></Reveal>
            <RevealGroup className="grid gap-3 sm:grid-cols-2">
              {c.universities.map((u) => (
                <RevealItem key={u.id}>
                  <Link href={`/universities/${u.slug}`} className="block pop pop-hover rounded-tile bg-card p-4">
                    <p className="font-medium text-navy">{u.name}</p>
                    <p className="text-sm text-muted-foreground">{u.city}</p>
                  </Link>
                </RevealItem>
              ))}
            </RevealGroup>
          </div>
        )}

        <Reveal className="mt-12 text-center">
          <StudyWorldButton href={`/programs?countryId=${c.id}`} accent={accent}>
            {t('seePrograms', { country: c.name })}
          </StudyWorldButton>
        </Reveal>
      </section>
    </PublicShell>
  );
}
