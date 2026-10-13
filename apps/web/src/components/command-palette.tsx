'use client';

import * as D from '@radix-ui/react-dialog';
import { useQuery } from '@tanstack/react-query';
import { Search, UserPlus, Users } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useEffect, useRef, useState } from 'react';
import { Link } from '@/i18n/navigation';
import { api } from '@/lib/api';
import type { Candidate, Paginated, Prospect } from '@/lib/types';
import { useAuth } from '@/features/auth/auth-context';

/**
 * Recherche globale (Ctrl+K / Cmd+K) : candidats et prospects, les deux recherches "qui est cette personne"
 * les plus fréquentes au quotidien. Les tâches n'ont pas de recherche côté API pour l'instant — pas ajouté ici
 * pour ne pas construire une fonctionnalité sur un endpoint qui n'existe pas encore.
 */
export function CommandPalette() {
  const t = useTranslations('common');
  const { can } = useAuth();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [debounced, setDebounced] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOpen((v) => !v);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  useEffect(() => {
    const id = setTimeout(() => setDebounced(query.trim()), 200);
    return () => clearTimeout(id);
  }, [query]);

  useEffect(() => {
    if (!open) { setQuery(''); setDebounced(''); }
  }, [open]);

  const canCandidates = can('candidate.view');
  const canProspects = can('prospect.view');
  const active = debounced.length >= 2;

  const candidates = useQuery({
    queryKey: ['search', 'candidates', debounced],
    queryFn: () => api<Paginated<Candidate>>('/candidates', { query: { search: debounced, pageSize: 5 } }),
    enabled: active && canCandidates,
  });
  const prospects = useQuery({
    queryKey: ['search', 'prospects', debounced],
    queryFn: () => api<Paginated<Prospect>>('/prospects', { query: { search: debounced, pageSize: 5 } }),
    enabled: active && canProspects,
  });

  const candidateItems = candidates.data?.items ?? [];
  const prospectItems = prospects.data?.items ?? [];
  const isLoading = (canCandidates && candidates.isLoading) || (canProspects && prospects.isLoading);
  const noResults = active && !isLoading && candidateItems.length === 0 && prospectItems.length === 0;

  return (
    <D.Root open={open} onOpenChange={setOpen}>
      <D.Trigger className="inline-flex h-9 items-center gap-2 rounded-full border border-border bg-card px-3 text-sm text-muted-foreground hover:bg-muted">
        <Search className="h-4 w-4" aria-hidden />
        <span className="hidden sm:inline">{t('search')}</span>
        <kbd className="hidden rounded border border-border bg-muted px-1.5 py-0.5 text-[10px] font-medium sm:inline">Ctrl K</kbd>
      </D.Trigger>
      <D.Portal>
        <D.Overlay className="fixed inset-0 z-40 bg-navy/50" />
        <D.Content
          className="fixed start-1/2 top-24 z-50 w-[calc(100%-2rem)] max-w-xl -translate-x-1/2 overflow-hidden rounded-organic border border-border bg-card shadow-2xl rtl:translate-x-1/2"
          onOpenAutoFocus={(e) => { e.preventDefault(); inputRef.current?.focus(); }}
        >
          <D.Title className="sr-only">{t('search')}</D.Title>
          <D.Description className="sr-only">{t('search')}</D.Description>
          <div className="flex items-center gap-3 border-b border-border px-4 py-3">
            <Search className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t('searchPlaceholder')}
              className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            />
          </div>
          <div className="max-h-96 overflow-y-auto p-2">
            {!active ? (
              <p className="px-3 py-6 text-center text-sm text-muted-foreground">{t('searchHint')}</p>
            ) : isLoading ? (
              <p className="px-3 py-6 text-center text-sm text-muted-foreground">{t('loading')}</p>
            ) : noResults ? (
              <p className="px-3 py-6 text-center text-sm text-muted-foreground">{t('searchNoResults')}</p>
            ) : (
              <>
                {candidateItems.length > 0 && (
                  <div className="mb-1">
                    <p className="px-3 py-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">{t('candidatesGroup')}</p>
                    {candidateItems.map((c) => (
                      <Link key={c.id} href={`/candidates/${c.id}`} onClick={() => setOpen(false)} className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm hover:bg-primary-soft">
                        <Users className="h-4 w-4 shrink-0 text-primary" aria-hidden />
                        <span className="font-medium text-navy">{c.firstName} {c.lastName}</span>
                        <span className="text-xs text-muted-foreground" dir="ltr">{c.phone}</span>
                      </Link>
                    ))}
                  </div>
                )}
                {prospectItems.length > 0 && (
                  <div>
                    <p className="px-3 py-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">{t('prospectsGroup')}</p>
                    {prospectItems.map((p) => (
                      <Link key={p.id} href="/prospects" onClick={() => setOpen(false)} className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm hover:bg-primary-soft">
                        <UserPlus className="h-4 w-4 shrink-0 text-primary" aria-hidden />
                        <span className="font-medium text-navy">{p.firstName} {p.lastName}</span>
                        <span className="text-xs text-muted-foreground" dir="ltr">{p.phone}</span>
                      </Link>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        </D.Content>
      </D.Portal>
    </D.Root>
  );
}
