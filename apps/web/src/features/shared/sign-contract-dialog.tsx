'use client';

import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { Field, Input } from '@/components/ui/form';
import { SignaturePad } from '@/components/ui/signature-pad';
import type { Contract } from '@/lib/types';

/** Partagé entre le dossier candidat (employé, signature en présentiel) et le portail (signature à distance). */
export function SignContractDialog({
  contract, open, onOpenChange, onSign, loading,
}: {
  contract: Contract | null;
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onSign: (v: { signatureImage: string; signerName: string; method: 'DRAWN' }) => void;
  loading: boolean;
}) {
  const t = useTranslations('candidates');
  const tc = useTranslations('common');
  const [signerName, setSignerName] = useState('');
  const [signatureImage, setSignatureImage] = useState<string | null>(null);

  return (
    <Dialog open={open} onOpenChange={(o) => { onOpenChange(o); if (o) { setSignerName(''); setSignatureImage(null); } }} title={t('signContract')} description={contract ? t('signContractHint', { number: contract.number }) : undefined}>
      <div className="space-y-4">
        <Field label={t('signerName')} htmlFor="signer-name">
          <Input id="signer-name" value={signerName} onChange={(e) => setSignerName(e.target.value)} />
        </Field>
        <SignaturePad onChange={setSignatureImage} />
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="secondary" onClick={() => onOpenChange(false)}>{tc('cancel')}</Button>
          <Button
            disabled={!signerName.trim() || !signatureImage}
            loading={loading}
            onClick={() => signatureImage && onSign({ signatureImage, signerName, method: 'DRAWN' })}
          >
            {t('confirmSignature')}
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
