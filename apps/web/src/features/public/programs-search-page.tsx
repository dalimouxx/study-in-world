'use client';

import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { Search } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { EmptyState } from '@/components/empty-state';
import { Button } from '@/components/ui/button';
import { Input, Select } from '@/components/ui/form';
import { Pagination } from '@/components/ui/pagination';
import { Link, useRouter } from '@/i18n/navigation';
import { api } from '@/lib/api';
import type { Country, Paginated, Program, ProgramLevel } from '@/lib/types';
import { Reveal, RevealGroup, RevealItem } from './design-system';
import { PublicShell } from './public-shell';

const LEVELS: ProgramLevel[] = ['LICENCE', 'MASTER', 'DOCTORAT', 'FOUNDATION', 'PREPA', 'FORMATION_PRO', 'FORMATION_PRIVEE', 'FORMATION_PUBLIQUE', 'SEJOUR_LINGUISTIQUE', 'COURS_DE_LANGUE', 'CERTIFICAT'];

export function ProgramsSearchPage() {
  const t = useTranslations('public');
  const tc = useTranslations('common');
  const router = useRouter();
  const searchParams = useSearchParams();

  const [page, setPage] = useState(1);
  const [countryId, setCountryId] = useState(searchParams.get('countryId') ?? '');
  const [level, setLevel] = useState('');
  const [maxBudget, setMaxBudget] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [compareIds, setCompareIds] = useState<string[]>([]);

  useEffect(() => {
    const id = setTimeout(() => { setSearch(searchInput.trim()); setPage(1); }, 300);
    return () => clearTimeout(id);
  }, [searchInput]);

  const countries = useQuery({ queryKey: ['public', 'countries'], queryFn: () => api<Country[]>('/public/catalog/countries', { auth: false }) });
  const results = useQuery({
    queryKey: ['public', 'programs', { page, countryId, level, maxBudget, search }],
    queryFn: () =>
      api<Paginated<Program>>('/public/catalog/programs', {
        auth: false,
        query: { page, pageSize: 12, countryId: countryId || undefined, level: level || undefined, maxBudget: maxBudget || undefined, search: search || undefined },
      }),
    placeholderData: keepPreviousData,
  });

  const toggleCompare = (id: string) =>
    setCompareIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : prev.length < 4 ? [...prev, id] : prev));

  const items = results.data?.items ?? [];

  return (
    <PublicShell>
      <section className="mx-auto max-w-6xl px-6 py-14">
        <Reveal className="mx-auto max-w-2xl text-center">
          <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
            <Search className="h-5 w-5" aria-hidden />
          </span>
          <h1 className="mt-3 font-poppins text-3xl font-bold text-navy">{t('programsTitle')}</h1>
          <p className="mt-2 text-muted-foreground">{t('programsSubtitle')}</p>
        </Reveal>

        <Reveal delay={0.1} className="mt-8 grid gap-3 rounded-organic border border-primary/10 bg-white p-4 shadow-sm sm:grid-cols-4">
          <Input placeholder={t('searchProgramPlaceholder')} value={searchInput} onChange={(e) => setSearchInput(e.target.value)} />
          <Select aria-label={t('country')} value={countryId} onChange={(e) => { setCountryId(e.target.value); setPage(1); }}>
            <option value="">{t('allCountries')}</option>
            {(countries.data ?? []).map((c) => <option key={c.id} value={c.id}>{c.flagEmoji} {c.name}</option>)}
          </Select>
          <Select aria-label={t('level')} value={level} onChange={(e) => { setLevel(e.target.value); setPage(1); }}>
            <option value="">{t('allLevels')}</option>
            {LEVELS.map((l) => <option key={l} value={l}>{t(`levels.${l}`)}</option>)}
          </Select>
          <Input type="number" placeholder={t('maxBudgetPlaceholder')} dir="ltr" value={maxBudget} onChange={(e) => { setMaxBudget(e.target.value); setPage(1); }} />
        </Reveal>

        <div className="mt-8">
          {results.isLoading ? (
            <p role="status" className="text-center text-sm text-muted-foreground">{tc('loading')}</p>
          ) : items.length === 0 ? (
            <EmptyState title={t('emptyProgramsSearch')} />
          ) : (
            <>
              <RevealGroup className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                {items.map((p) => (
                  <RevealItem key={p.id}>
                    <div className="rounded-organic border border-primary/10 bg-white p-5 shadow-sm transition-shadow hover:shadow-md">
                      <p className="text-xs text-muted-foreground">{p.university?.country?.flagEmoji} {p.university?.name} · {p.university?.city}</p>
                      <Link href={`/programs/${p.slug}`} className="mt-1 block font-semibold text-navy hover:text-primary">{p.name}</Link>
                      <p className="mt-1 text-sm text-muted-foreground">{t(`levels.${p.level}`)}{p.tuitionFees ? ` · ${p.tuitionFees} ${p.currency}` : ''}</p>
                      <label className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
                        <input type="checkbox" checked={compareIds.includes(p.id)} disabled={!compareIds.includes(p.id) && compareIds.length >= 4} onChange={() => toggleCompare(p.id)} />
                        {t('addToCompare')}
                      </label>
                    </div>
                  </RevealItem>
                ))}
              </RevealGroup>
              <div className="mt-6">
                <Pagination page={page} pageSize={12} total={results.data?.total ?? 0} onPage={setPage} />
              </div>
            </>
          )}
        </div>
      </section>

      {compareIds.length >= 2 && (
        <div className="fixed inset-x-0 bottom-4 z-30 flex justify-center">
          <div className="flex items-center gap-3 rounded-full border border-primary/15 bg-white px-5 py-2 shadow-lg">
            <span className="text-sm text-navy">{t('compareCount', { count: compareIds.length })}</span>
            <Button size="sm" className="!rounded-full" onClick={() => router.push(`/programs/compare?ids=${compareIds.join(',')}`)}>{t('compareNow')}</Button>
          </div>
        </div>
      )}
    </PublicShell>
  );
}
