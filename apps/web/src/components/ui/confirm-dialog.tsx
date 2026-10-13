'use client';

import { useTranslations } from 'next-intl';
import { Button } from './button';
import { Dialog } from './dialog';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  confirmLabel: string;
  loading?: boolean;
  onConfirm: () => void;
}

export function ConfirmDialog({ open, onOpenChange, title, description, confirmLabel, loading, onConfirm }: Props) {
  const t = useTranslations('common');
  return (
    <Dialog open={open} onOpenChange={onOpenChange} title={title} description={description}>
      <div className="mt-2 flex justify-end gap-2">
        <Button variant="secondary" onClick={() => onOpenChange(false)}>
          {t('cancel')}
        </Button>
        <Button variant="danger" loading={loading} onClick={onConfirm}>
          {confirmLabel}
        </Button>
      </div>
    </Dialog>
  );
}
