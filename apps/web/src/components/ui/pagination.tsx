'use client';

import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Button } from './button';

interface Props {
  page: number;
  pageSize: number;
  total: number;
  onPage: (page: number) => void;
}

export function Pagination({ page, pageSize, total, onPage }: Props) {
  const t = useTranslations('common');
  const pages = Math.max(1, Math.ceil(total / pageSize));
  return (
    <div className="flex items-center justify-between gap-3 px-4 py-3 text-sm text-muted-foreground">
      <span>{t('pageOf', { page, pages, total })}</span>
      <div className="flex gap-1">
        <Button variant="secondary" size="icon" disabled={page <= 1} onClick={() => onPage(page - 1)} aria-label={t('previous')}>
          <ChevronLeft className="h-4 w-4 rtl:rotate-180" aria-hidden />
        </Button>
        <Button variant="secondary" size="icon" disabled={page >= pages} onClick={() => onPage(page + 1)} aria-label={t('next')}>
          <ChevronRight className="h-4 w-4 rtl:rotate-180" aria-hidden />
        </Button>
      </div>
    </div>
  );
}
