'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, ScanText, TriangleAlert } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { api } from '@/lib/api';
import type { OcrPassportField, OcrPassportResult } from '@/lib/types';
import { useErrorMessage } from '@/lib/use-error-message';

interface Props {
  candidateId: string;
  documentId: string | null;
  onOpenChange: (open: boolean) => void;
}

const PROFILE_FIELDS = ['birthDate', 'nationality'] as const;

/** OCR (section 20) : une suggestion à valider champ par champ, jamais une saisie automatique. */
export function OcrExtractDialog({ candidateId, documentId, onOpenChange }: Props) {
  const t = useTranslations('candidates');
  const tc = useTranslations('common');
  const errorMessage = useErrorMessage();
  const queryClient = useQueryClient();

  const extract = useMutation({
    mutationFn: () => api<OcrPassportResult>(`/documents/${documentId}/extract`, { method: 'POST' }),
    onError: (err) => toast.error(errorMessage(err)),
  });

  const apply = useMutation({
    mutationFn: (body: Record<string, string>) => api(`/candidates/${candidateId}`, { method: 'PATCH', body }),
    onSuccess: () => { void queryClient.invalidateQueries({ queryKey: ['candidates', candidateId] }); toast.success(tc('save')); },
    onError: (err) => toast.error(errorMessage(err)),
  });

  const open = !!documentId;
  const r = extract.data;

  const rows: { key: string; label: string; field: OcrPassportField | null; applyKey?: 'birthDate' | 'nationality' | 'passportNumber' }[] = r
    ? [
        { key: 'lastName', label: t('ocrLastName'), field: r.lastName },
        { key: 'firstName', label: t('ocrFirstName'), field: r.firstName },
        { key: 'documentNumber', label: t('passportNumber'), field: r.documentNumber, applyKey: 'passportNumber' },
        { key: 'nationality', label: t('nationality'), field: r.nationality, applyKey: 'nationality' },
        { key: 'birthDate', label: t('ocrBirthDate'), field: r.birthDate, applyKey: 'birthDate' },
        { key: 'expirationDate', label: t('ocrExpirationDate'), field: r.expirationDate },
      ]
    : [];

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => { onOpenChange(o); if (o && documentId) extract.mutate(); }}
      title={t('ocrExtractTitle')}
      description={t('ocrExtractHint')}
    >
      {extract.isPending ? (
        <p role="status" className="flex items-center gap-2 text-sm text-muted-foreground"><ScanText className="h-4 w-4 animate-pulse" aria-hidden />{t('ocrRunning')}</p>
      ) : !r ? null : !r.success ? (
        <p role="alert" className="flex items-start gap-2 text-sm text-destructive"><TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />{r.warning}</p>
      ) : (
        <div className="space-y-3">
          {r.warning && (
            <p role="alert" className="flex items-start gap-2 rounded-md border border-accent/60 bg-accent/10 px-3 py-2 text-sm">
              <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-accent" aria-hidden />{r.warning}
            </p>
          )}
          <ul className="divide-y divide-border rounded-md border border-border">
            {rows.map(({ key, label, field, applyKey }) => (
              <li key={key} className="flex items-center justify-between gap-3 px-4 py-2.5">
                <div>
                  <p className="text-xs text-muted-foreground">{label}</p>
                  <p className="text-sm font-medium" dir={key === 'documentNumber' ? 'ltr' : undefined}>{field?.value ?? '—'}</p>
                </div>
                <div className="flex items-center gap-2">
                  {field?.value && (field.valid ? <CheckCircle2 className="h-4 w-4 text-success" aria-hidden /> : <Badge tone="danger">{t('ocrChecksumFailed')}</Badge>)}
                  {applyKey && field?.value && (
                    <Button size="sm" variant="secondary" loading={apply.isPending} onClick={() => apply.mutate({ [applyKey]: field.value! })}>
                      {t('ocrApply')}
                    </Button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
      <div className="mt-4 flex justify-end">
        <Button variant="secondary" onClick={() => onOpenChange(false)}>{tc('close')}</Button>
      </div>
    </Dialog>
  );
}
