'use client';

import { useQuery } from '@tanstack/react-query';
import { FileText, Receipt } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { EmptyState } from '@/components/empty-state';
import { ListSkeleton } from '@/components/ui/skeleton';
import { StaggerGroup, StaggerItem } from '@/components/motion';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { getPortalAccessToken, portalApi, portalApiBaseUrl } from '@/lib/portal-api';
import type { Invoice, InvoiceStatus, LineItem } from '@/lib/types';

const TONE: Record<InvoiceStatus, 'neutral' | 'primary' | 'success' | 'danger'> = { DRAFT: 'neutral', ISSUED: 'primary', PARTIALLY_PAID: 'primary', PAID: 'success', CANCELLED: 'danger' };
const total = (items: LineItem[]) => items.reduce((s, i) => s + i.quantity * i.unitPrice, 0);
const fmt = (n: number, currency: string) => `${n.toFixed(3)} ${currency}`;

function openPdf(path: string) {
  const token = getPortalAccessToken();
  fetch(`${portalApiBaseUrl}${path}`, { credentials: 'include', headers: token ? { Authorization: `Bearer ${token}` } : undefined })
    .then((r) => r.blob())
    .then((blob) => window.open(URL.createObjectURL(blob), '_blank'));
}

export function PortalFinancePage() {
  const t = useTranslations('portal');
  const tc = useTranslations('common');
  const query = useQuery({ queryKey: ['portal', 'invoices'], queryFn: () => portalApi<Invoice[]>('/portal/invoices') });
  const items = query.data ?? [];

  return (
    <>
      <h1 className="font-poppins text-2xl font-bold tracking-tight text-navy">{t('financeTitle')}</h1>
      <p className="mt-1 text-muted-foreground">{t('financeSubtitle')}</p>

      <div className="mt-6">
        {query.isLoading ? (
          <ListSkeleton count={4} />
        ) : items.length === 0 ? (
          <EmptyState title={t('emptyInvoices')} />
        ) : (
          <StaggerGroup className="space-y-3">
            {items.map((inv) => {
              const invTotal = total(inv.items);
              const paid = inv.payments.reduce((s, p) => s + p.amount, 0);
              const pct = invTotal > 0 ? Math.min(100, (paid / invTotal) * 100) : 0;
              return (
                <StaggerItem key={inv.id}>
                  <Card hoverable className="p-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="min-w-[10rem] flex-1">
                        <p className="font-medium text-navy">{inv.number}</p>
                        <p className="text-sm text-muted-foreground">{fmt(paid, inv.currency)} / {fmt(invTotal, inv.currency)}</p>
                        <div className="mt-1.5 h-1.5 max-w-xs overflow-hidden rounded-full bg-muted">
                          <div className="h-full rounded-full bg-success transition-all duration-500" style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge tone={TONE[inv.status]}>{t(`invoiceStatuses.${inv.status}`)}</Badge>
                        <Button variant="ghost" size="icon" aria-label={tc('download')} onClick={() => openPdf(`/portal/invoices/${inv.id}/pdf`)}>
                          <FileText className="h-4 w-4" aria-hidden />
                        </Button>
                      </div>
                    </div>
                    {inv.payments.length > 0 && (
                      <ul className="mt-3 space-y-1 border-t border-border pt-3 text-sm text-muted-foreground">
                        {inv.payments.map((p) => (
                          <li key={p.id} className="flex items-center justify-between">
                            <span>{t(`paymentMethods.${p.method}`)} · {fmt(p.amount, inv.currency)}</span>
                            <Receipt className="h-4 w-4" aria-hidden />
                          </li>
                        ))}
                      </ul>
                    )}
                  </Card>
                </StaggerItem>
              );
            })}
          </StaggerGroup>
        )}
      </div>
    </>
  );
}
