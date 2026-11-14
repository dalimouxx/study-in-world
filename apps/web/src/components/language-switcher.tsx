'use client';

import { useLocale, useTranslations } from 'next-intl';
import { usePathname, useRouter } from '@/i18n/navigation';
import { cn } from '@/lib/utils';

const LABELS = { fr: 'Français', ar: 'العربية' } as const;

export function LanguageSwitcher({ className, dark }: { className?: string; dark?: boolean }) {
  const locale = useLocale();
  const t = useTranslations('common');
  const router = useRouter();
  const pathname = usePathname();

  return (
    <div role="group" aria-label={t('language')} className={cn('inline-flex rounded-xl border-2 p-0.5 text-sm font-semibold', dark ? 'border-white/40' : 'border-ink bg-card', className)}>
      {(['fr', 'ar'] as const).map((l) => (
        <button
          key={l}
          type="button"
          lang={l}
          aria-pressed={locale === l}
          onClick={() => router.replace(pathname, { locale: l })}
          className={cn(
            'rounded-lg px-2.5 py-1 transition-colors',
            locale === l
              ? dark ? 'bg-white text-navy' : 'bg-primary text-primary-foreground'
              : dark ? 'text-white/80 hover:bg-white/10' : 'text-muted-foreground hover:bg-muted',
          )}
        >
          {LABELS[l]}
        </button>
      ))}
    </div>
  );
}
