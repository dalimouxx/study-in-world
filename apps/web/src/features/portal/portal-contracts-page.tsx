'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { FileSignature, FileText } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { toast } from 'sonner';
import { EmptyState } from '@/components/empty-state';
import { ListSkeleton } from '@/components/ui/skeleton';
import { StaggerGroup, StaggerItem } from '@/components/motion';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { SignContractDialog } from '@/features/shared/sign-contract-dialog';
import { getPortalAccessToken, portalApi, portalApiBaseUrl } from '@/lib/portal-api';
import type { Contract, ContractStatus } from '@/lib/types';
import { useErrorMessage } from '@/lib/use-error-message';

const TONE: Record<ContractStatus, 'neutral' | 'primary' | 'success' | 'danger'> = { DRAFT: 'neutral', SENT: 'primary', SIGNED: 'success', CANCELLED: 'danger' };

function openPdf(path: string) {
  const token = getPortalAccessToken();
  fetch(`${portalApiBaseUrl}${path}`, { credentials: 'include', headers: token ? { Authorization: `Bearer ${token}` } : undefined })
    .then((r) => r.blob())
    .then((blob) => window.open(URL.createObjectURL(blob), '_blank'));
}

export function PortalContractsPage() {
  const t = useTranslations('portal');
  const tc = useTranslations('common');
  const errorMessage = useErrorMessage();
  const queryClient = useQueryClient();
  const [signing, setSigning] = useState<Contract | null>(null);

  const query = useQuery({ queryKey: ['portal', 'contracts'], queryFn: () => portalApi<Contract[]>('/portal/contracts') });
  const sign = useMutation({
    mutationFn: (v: { signatureImage: string; signerName: string; method: 'DRAWN' }) => portalApi(`/portal/contracts/${signing!.id}/sign`, { method: 'POST', body: v }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['portal', 'contracts'] });
      setSigning(null);
      toast.success(t('contractSigned'));
    },
    onError: (err) => toast.error(errorMessage(err)),
  });

  const items = query.data ?? [];

  return (
    <>
      <h1 className="font-poppins text-2xl font-bold tracking-tight text-navy">{t('contractsTitle')}</h1>
      <p className="mt-1 text-muted-foreground">{t('contractsSubtitle')}</p>

      <div className="mt-6">
        {query.isLoading ? (
          <ListSkeleton count={4} />
        ) : items.length === 0 ? (
          <EmptyState title={t('emptyContracts')} />
        ) : (
          <StaggerGroup className="space-y-3">
            {items.map((ctr) => (
              <StaggerItem key={ctr.id}>
                <Card hoverable className="flex flex-wrap items-center justify-between gap-3 p-4">
                  <div>
                    <p className="font-medium text-navy">{ctr.number}</p>
                    <p className="text-sm text-muted-foreground">{ctr.totalAmount.toFixed(3)} {ctr.currency}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge tone={TONE[ctr.status]}>{t(`contractStatuses.${ctr.status}`)}</Badge>
                    <Button variant="ghost" size="icon" aria-label={tc('download')} onClick={() => openPdf(`/portal/contracts/${ctr.id}/pdf`)}>
                      <FileText className="h-4 w-4" aria-hidden />
                    </Button>
                    {(ctr.status === 'DRAFT' || ctr.status === 'SENT') && (
                      <Button size="sm" className="!rounded-full" onClick={() => setSigning(ctr)}>
                        <FileSignature className="h-4 w-4" aria-hidden />{t('signContract')}
                      </Button>
                    )}
                  </div>
                </Card>
              </StaggerItem>
            ))}
          </StaggerGroup>
        )}
      </div>

      <SignContractDialog contract={signing} open={!!signing} onOpenChange={(o) => !o && setSigning(null)} onSign={(v) => sign.mutate(v)} loading={sign.isPending} />
    </>
  );
}
