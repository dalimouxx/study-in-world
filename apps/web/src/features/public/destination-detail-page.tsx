'use client';

import { useQuery } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { api } from '@/lib/api';
import type { Country } from '@/lib/types';
import { useErrorMessage } from '@/lib/use-error-message';
import { countryAccentColor, destinationHeroImage, FlagBadge, Reveal, RevealGroup, RevealItem, StudyWorldButton } from './design-system';
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
      <section className="relative flex min-h-[280px] items-end overflow-hidden">
        {hero ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={hero} alt="" className="absolute inset-0 h-full w-full object-cover object-top" />
        ) : (
          <div className="absolute inset-0" style={{ background: `linear-gradient(135deg, hsl(var(--navy)), ${accent})` }} />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-navy/80 via-navy/10 to-transparent" aria-hidden />
        <Reveal className="relative z-10 px-6 pb-8 sm:px-10">
          <FlagBadge flag={c.flagEmoji} name={c.name} />
          <h1 className="mt-3 font-poppins text-4xl font-bold text-white sm:text-5xl">{c.name}</h1>
        </Reveal>
      </section>

      <section className="mx-auto max-w-4xl px-6 py-12">
        {c.description && <Reveal><p className="text-lg text-muted-foreground">{c.description}</p></Reveal>}

        <RevealGroup className="mt-8 grid gap-4 sm:grid-cols-2">
          {SECTIONS.filter((k) => c[k]).map((k) => (
            <RevealItem key={k}>
              <div className="h-full rounded-organic border border-primary/10 bg-white p-5 shadow-sm">
                <h2 className="font-poppins font-semibold text-navy">{t(`destinationSections.${k}`)}</h2>
                <p className="mt-1.5 whitespace-pre-line text-sm text-muted-foreground">{c[k]}</p>
              </div>
            </RevealItem>
          ))}
        </RevealGroup>

        {!!c.universities?.length && (
          <div className="mt-12">
            <Reveal><h2 className="mb-4 font-poppins text-xl font-bold text-navy">{t('universitiesIn', { country: c.name })}</h2></Reveal>
            <RevealGroup className="grid gap-3 sm:grid-cols-2">
              {c.universities.map((u) => (
                <RevealItem key={u.id}>
                  <Link href={`/universities/${u.slug}`} className="block rounded-organic border border-primary/10 bg-white p-4 shadow-sm transition-shadow hover:shadow-md">
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
