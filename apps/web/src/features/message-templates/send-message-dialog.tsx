'use client';

import { useMutation, useQuery } from '@tanstack/react-query';
import { MessageCircle } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { Field, Select, Textarea } from '@/components/ui/form';
import { api } from '@/lib/api';
import { buildWhatsappUrl } from '@/lib/reminder-text';

type Entity = { entityType: 'CANDIDATE' | 'PROSPECT'; entityId: string; phone: string | null };
type TemplateName = { key: string; nameFr: string; nameAr: string; isSystem: boolean };

/** Bouton + fenêtre « Envoyer un message » : choisir un modèle, relire ou modifier le texte, ouvrir WhatsApp. */
export function SendMessageButton(props: Entity & { size?: 'sm' | 'md'; iconOnly?: boolean }) {
  const t = useTranslations('messageTemplates');
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button
        variant="secondary"
        size={props.iconOnly ? 'icon' : (props.size ?? 'sm')}
        onClick={() => setOpen(true)}
        disabled={!buildWhatsappUrl(props.phone, 'x')}
        aria-label={t('send')}
        title={buildWhatsappUrl(props.phone, 'x') ? t('send') : t('noPhone')}
      >
        <MessageCircle className="h-4 w-4 text-success" aria-hidden />
        {!props.iconOnly && t('send')}
      </Button>
      <SendMessageDialog {...props} open={open} onOpenChange={setOpen} />
    </>
  );
}

function SendMessageDialog({ entityType, entityId, phone, open, onOpenChange }: Entity & { open: boolean; onOpenChange: (o: boolean) => void }) {
  const t = useTranslations('messageTemplates');
  const tc = useTranslations('common');
  const locale = useLocale();
  const [key, setKey] = useState('');
  const [text, setText] = useState('');

  const names = useQuery({ queryKey: ['message-templates', 'whatsapp'], queryFn: () => api<TemplateName[]>('/message-templates/whatsapp'), enabled: open });
  const rendered = useQuery({
    queryKey: ['message-templates', 'render', key, entityType, entityId],
    queryFn: () => api<{ body: string; language: 'fr' | 'ar' }>('/message-templates/render', { query: { key, channel: 'WHATSAPP', entityType, entityId } }),
    enabled: open && !!key,
  });
  const logSent = useMutation({ mutationFn: () => api('/message-templates/sent', { method: 'POST', body: { key, entityType, entityId } }) });

  useEffect(() => { if (open && !key && names.data?.length) setKey(names.data.find((n) => !n.isSystem)?.key ?? names.data[0]?.key ?? ''); }, [open, key, names.data]);
  useEffect(() => { if (rendered.data) setText(rendered.data.body); }, [rendered.data]);
  useEffect(() => { if (!open) { setKey(''); setText(''); } }, [open]);

  const url = buildWhatsappUrl(phone, text);
  return (
    <Dialog open={open} onOpenChange={onOpenChange} title={t('sendTitle')}>
      <div className="space-y-4">
        <Field label={t('chooseTemplate')} htmlFor="send-template">
          <Select id="send-template" value={key} onChange={(e) => setKey(e.target.value)}>
            {(names.data ?? []).map((n) => <option key={n.key} value={n.key}>{locale === 'ar' ? n.nameAr : n.nameFr}</option>)}
          </Select>
        </Field>
        <Field
          label={t('messageLabel')}
          htmlFor="send-text"
          hint={rendered.data ? t('inLanguage', { language: rendered.data.language === 'ar' ? tc('languageAr') : tc('languageFr') }) : undefined}
        >
          <Textarea id="send-text" rows={7} dir={rendered.data?.language === 'ar' ? 'rtl' : 'ltr'} value={text} onChange={(e) => setText(e.target.value)} />
        </Field>
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="secondary" onClick={() => onOpenChange(false)}>{tc('cancel')}</Button>
          <Button
            disabled={!url || !text.trim()}
            onClick={() => {
              if (!url) return;
              window.open(url, '_blank', 'noopener');
              logSent.mutate();
              onOpenChange(false);
            }}
          >
            <MessageCircle className="h-4 w-4" aria-hidden />
            {t('openWhatsapp')}
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
