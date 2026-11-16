'use client';

import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { Field, Input } from '@/components/ui/form';

const inDays = (n: number) => {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
};

/** Après la relance WhatsApp d'un prospect : quand faut-il le relancer ? (dans 3 jours par défaut, ou « aucune »). */
export function NextFollowUpDialog({
  open, onOpenChange, onChoose, loading,
}: { open: boolean; onOpenChange: (o: boolean) => void; onChoose: (date: string | null) => void; loading?: boolean }) {
  const t = useTranslations('reminders');
  const [date, setDate] = useState(inDays(3));
  useEffect(() => { if (open) setDate(inDays(3)); }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange} title={t('nextFollowUpTitle')} description={t('nextFollowUpHint')}>
      <div className="space-y-4">
        <div className="flex flex-wrap gap-2">
          {[1, 3, 7, 14].map((n) => (
            <Button key={n} size="sm" variant={date === inDays(n) ? 'primary' : 'secondary'} onClick={() => setDate(inDays(n))}>
              +{n}
            </Button>
          ))}
        </div>
        <Field label={t('nextFollowUpTitle')} htmlFor="next-follow-up">
          <Input id="next-follow-up" type="date" dir="ltr" value={date} min={inDays(0)} onChange={(e) => setDate(e.target.value)} />
        </Field>
        <div className="flex flex-wrap justify-end gap-2 pt-2">
          <Button variant="ghost" onClick={() => onChoose(null)} disabled={loading}>{t('nextFollowUpNone')}</Button>
          <Button onClick={() => onChoose(date ? new Date(`${date}T09:00:00`).toISOString() : null)} loading={loading}>{t('save')}</Button>
        </div>
      </div>
    </Dialog>
  );
}
