'use client';

import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { PageHeader } from '@/components/page-header';
import { RequirePermission } from '@/components/require-permission';
import { cn } from '@/lib/utils';
import { CountriesTab } from './countries-tab';
import { ProgramsTab } from './programs-tab';
import { UniversitiesTab } from './universities-tab';

const TABS = ['countries', 'universities', 'programs'] as const;
type Tab = (typeof TABS)[number];

export function CatalogPage() {
  return (
    <RequirePermission permission="catalog.view">
      <Content />
    </RequirePermission>
  );
}

function Content() {
  const t = useTranslations('catalog');
  const [tab, setTab] = useState<Tab>('countries');

  return (
    <>
      <PageHeader title={t('title')} description={t('subtitle')} />
      <div role="tablist" aria-label={t('title')} className="mb-4 flex gap-1 overflow-x-auto rounded-md border border-border bg-card p-1 text-sm">
        {TABS.map((key) => (
          <button
            key={key} role="tab" id={`catalog-tab-${key}`} aria-selected={tab === key} aria-controls={`catalog-panel-${key}`}
            type="button" onClick={() => setTab(key)}
            className={cn('shrink-0 rounded px-3 py-1.5 whitespace-nowrap', tab === key ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted')}
          >
            {t(`tabs.${key}`)}
          </button>
        ))}
      </div>
      <div role="tabpanel" id={`catalog-panel-${tab}`} aria-labelledby={`catalog-tab-${tab}`}>
        {tab === 'countries' && <CountriesTab />}
        {tab === 'universities' && <UniversitiesTab />}
        {tab === 'programs' && <ProgramsTab />}
      </div>
    </>
  );
}
