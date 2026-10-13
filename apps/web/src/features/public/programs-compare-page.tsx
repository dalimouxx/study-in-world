'use client';

import { useQuery } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { EmptyState } from '@/components/empty-state';
import { api } from '@/lib/api';
import type { Program } from '@/lib/types';
import { Reveal } from './design-system';
import { PublicShell } from './public-shell';

const ROWS = ['level', 'domain', 'language', 'durationMonths', 'fees', 'deadline', 'minIelts'] as const;

export function ProgramsComparePage({ ids }: { ids: string[] }) {
  const t = useTranslations('public');
  const tc = useTranslations('common');
  const query = useQuery({
    queryKey: ['public', 'programs', 'compare', ids],
    queryFn: () => api<Program[]>('/public/catalog/programs/compare', { auth: false, query: { ids: ids.join(',') } }),
    enabled: ids.length > 0,
  });

  const programs = query.data ?? [];

  return (
    <PublicShell>
      <section className="mx-auto max-w-5xl px-6 py-14">
        <Reveal><h1 className="mb-6 font-poppins text-3xl font-bold text-navy">{t('compareTitle')}</h1></Reveal>
        {query.isLoading ? (
          <p role="status" className="text-sm text-muted-foreground">{tc('loading')}</p>
        ) : programs.length === 0 ? (
          <EmptyState title={t('emptyCompare')} />
        ) : (
          <Reveal delay={0.1} className="overflow-x-auto rounded-organic border border-primary/10 bg-white shadow-sm">
            <table className="w-full min-w-[600px] border-collapse text-sm">
              <thead>
                <tr>
                  <th className="border-b border-border p-4 text-start"> </th>
                  {programs.map((p) => (
                    <th key={p.id} className="border-b border-border p-4 text-start">
                      <div className="font-semibold text-navy">{p.name}</div>
                      <div className="text-xs text-muted-foreground">{p.university?.name}</div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {ROWS.map((row) => (
                  <tr key={row} className="odd:bg-sw-bg-light/50">
                    <td className="border-b border-border p-4 font-medium text-muted-foreground">{t(`compareRows.${row}`)}</td>
                    {programs.map((p) => (
                      <td key={p.id} className="border-b border-border p-4">
                        {row === 'level' ? t(`levels.${p.level}`)
                          : row === 'fees' ? (p.tuitionFees ? `${p.tuitionFees} ${p.currency}` : '–')
                          : row === 'deadline' ? (p.deadline ? new Date(p.deadline).toLocaleDateString() : '–')
                          : row === 'minIelts' ? (p.minIelts ?? '–')
                          : (p[row] ?? '–')}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </Reveal>
        )}
      </section>
    </PublicShell>
  );
}
