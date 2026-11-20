'use client';

import { useQuery } from '@tanstack/react-query';
import { BellRing } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { api } from '@/lib/api';
import type { TodayResponse } from './types';

/** Tuile du tableau de bord : nombre de relances du jour à faire, lien vers la page. */
export function RemindersWidget() {
  const t = useTranslations('reminders');
  const query = useQuery({ queryKey: ['reminders', 'today', 'mine'], queryFn: () => api<TodayResponse>('/reminders/today', { query: { scope: 'mine' } }), retry: false });
  if (query.isError) return null;
  const count = query.data?.items.length ?? 0;
  return (
    <Link href="/reminders" className="pop pop-hover mb-6 flex items-center gap-4 rounded-tile bg-card p-5">
      <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border-[1.5px] border-ink bg-primary text-white">
        <BellRing className="h-5 w-5" aria-hidden />
      </span>
      <span className="min-w-0">
        <span className="block font-display text-lg font-extrabold text-ink">{t('widgetTitle')}</span>
        <span className="block text-sm text-muted-foreground">{query.isLoading ? '…' : t('widgetCount', { count })}</span>
      </span>
    </Link>
  );
}
