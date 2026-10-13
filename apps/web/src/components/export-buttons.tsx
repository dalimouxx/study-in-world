'use client';

import { FileSpreadsheet, FileText } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { toast } from 'sonner';
import { downloadFile } from '@/lib/download';
import { Button } from './ui/button';

/** Deux boutons d'export (Excel / PDF), sur la même route avec juste ?format= différent. */
export function ExportButtons({ path, filenameBase }: { path: string; filenameBase: string }) {
  const t = useTranslations('common');
  const [loading, setLoading] = useState<'xlsx' | 'pdf' | null>(null);

  const run = async (format: 'xlsx' | 'pdf') => {
    setLoading(format);
    try {
      const sep = path.includes('?') ? '&' : '?';
      await downloadFile(`${path}${sep}format=${format}`, `${filenameBase}.${format}`);
    } catch {
      toast.error(t('exportFailed'));
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className="flex items-center gap-1">
      <Button variant="secondary" size="sm" loading={loading === 'xlsx'} onClick={() => run('xlsx')}>
        <FileSpreadsheet className="h-4 w-4" aria-hidden /> Excel
      </Button>
      <Button variant="secondary" size="sm" loading={loading === 'pdf'} onClick={() => run('pdf')}>
        <FileText className="h-4 w-4" aria-hidden /> PDF
      </Button>
    </div>
  );
}
