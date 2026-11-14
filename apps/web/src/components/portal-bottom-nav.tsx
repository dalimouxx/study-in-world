'use client';

import * as D from '@radix-ui/react-dialog';
import { LayoutGrid, X, type LucideIcon } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { Link, usePathname } from '@/i18n/navigation';
import { cn } from '@/lib/utils';

export type PortalNavItem = { href: `/portal/${string}`; labelKey: string; icon: LucideIcon };

/** Rubriques toujours visibles dans la barre du bas ; les autres passent dans le panneau « Plus ». */
const PINNED = ['dashboard', 'documents', 'messages', 'appointments'];

/**
 * Navigation du portail candidat sur téléphone : 4 rubriques fixes en bas d'écran + un bouton « Plus »
 * qui ouvre un panneau avec toutes les autres. Aucune rubrique n'est jamais inaccessible.
 */
export function PortalBottomNav({ items }: { items: PortalNavItem[] }) {
  const t = useTranslations('portal');
  const tc = useTranslations('common');
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const pinned = PINNED.map((k) => items.find((i) => i.labelKey === k)).filter((i): i is PortalNavItem => !!i);
  const others = items.filter((i) => !PINNED.includes(i.labelKey));
  const otherActive = others.some((i) => pathname === i.href);

  const tab = (active: boolean) =>
    cn(
      'flex min-w-0 flex-1 flex-col items-center gap-0.5 rounded-xl px-0.5 py-1.5 text-[10px] font-semibold leading-tight transition-colors',
      active ? 'bg-primary text-white' : 'text-ink/70 hover:bg-primary-soft hover:text-primary',
    );

  return (
    <nav
      aria-label={t('title')}
      className="fixed inset-x-0 bottom-0 z-40 px-3 pt-2 md:hidden"
      style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}
    >
      <div className="flex gap-1 rounded-tile border-pop border-ink bg-card p-1.5 shadow-pop">
        {pinned.map(({ href, labelKey, icon: Icon }) => {
          const active = pathname === href;
          return (
            <Link key={href} href={href} aria-current={active ? 'page' : undefined} className={tab(active)}>
              <Icon className="h-5 w-5" aria-hidden />
              <span className="line-clamp-2 max-w-full text-center">{t(labelKey)}</span>
            </Link>
          );
        })}
        <D.Root open={open} onOpenChange={setOpen}>
          <D.Trigger className={tab(otherActive)}>
            <LayoutGrid className="h-5 w-5" aria-hidden />
            <span className="line-clamp-2 max-w-full text-center">{t('more')}</span>
          </D.Trigger>
          <D.Portal>
            <D.Overlay className="fixed inset-0 z-50 bg-ink/40 backdrop-blur-sm data-[state=open]:animate-fade-in" />
            <D.Content
              className="fixed inset-x-0 bottom-0 z-50 rounded-t-tile border-pop border-b-0 border-ink bg-card p-5 shadow-pop data-[state=open]:animate-pop-in"
              style={{ paddingBottom: 'max(1.25rem, env(safe-area-inset-bottom))' }}
            >
              <div className="mb-4 flex items-center justify-between">
                <D.Title className="font-display text-lg font-extrabold text-ink">{t('moreTitle')}</D.Title>
                <D.Description className="sr-only">{t('moreTitle')}</D.Description>
                <D.Close className="rounded-lg p-1.5 text-muted-foreground hover:bg-primary-soft" aria-label={tc('close')}>
                  <X className="h-5 w-5" aria-hidden />
                </D.Close>
              </div>
              <div className="grid grid-cols-2 gap-3">
                {others.map(({ href, labelKey, icon: Icon }) => {
                  const active = pathname === href;
                  return (
                    <Link
                      key={href}
                      href={href}
                      onClick={() => setOpen(false)}
                      aria-current={active ? 'page' : undefined}
                      className={cn(
                        'pop pop-hover flex items-center gap-2.5 rounded-xl px-3 py-3 text-sm font-semibold',
                        active ? 'bg-primary text-white' : 'bg-card text-ink',
                      )}
                    >
                      <Icon className="h-5 w-5 shrink-0" aria-hidden />
                      <span className="min-w-0 truncate">{t(labelKey)}</span>
                    </Link>
                  );
                })}
              </div>
            </D.Content>
          </D.Portal>
        </D.Root>
      </div>
    </nav>
  );
}
