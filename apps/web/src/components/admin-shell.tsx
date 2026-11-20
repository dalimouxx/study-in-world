'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { LogOut, Menu, UserRound, X } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useEffect, useState, type ReactNode } from 'react';
import { useAgency } from '@/features/auth/use-agency';
import { useAuth } from '@/features/auth/auth-context';
import { Link, usePathname } from '@/i18n/navigation';
import { isRtl } from '@/i18n/routing';
import { cn } from '@/lib/utils';
import { CommandPalette } from './command-palette';
import { LanguageSwitcher } from './language-switcher';
import { NotificationBell } from './notification-bell';
import { NAV_ITEMS } from './nav';

function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  const t = useTranslations('nav');
  const tc = useTranslations('common');
  const pathname = usePathname();
  const { user, can, logout } = useAuth();
  const agency = useAgency();
  const items = NAV_ITEMS.filter(
    (i) =>
      (!i.permission || can(i.permission)) &&
      (!i.anyPermission || i.anyPermission.some((p) => can(p))) &&
      (!i.platformAdminOnly || user?.isPlatformAdmin) &&
      (!i.superAdminOnly || user?.roleCode === 'SUPER_ADMIN'),
  );

  return (
    <div className="flex h-full flex-col">
      <div className="flex h-16 items-center gap-2.5 border-b border-border px-5">
        <span aria-hidden className="h-6 w-6 shrink-0 rounded-lg border-pop border-ink bg-primary shadow-pop-sm" />
        <span className="truncate font-display text-lg font-extrabold tracking-tight text-ink">{agency.data?.name ?? 'Study in World'}</span>
      </div>

      <nav aria-label={t('main')} className="flex-1 space-y-1 overflow-y-auto p-3">
        {items.map(({ href, labelKey, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(`${href}/`);
          return (
            <Link
              key={href}
              href={href}
              onClick={onNavigate}
              aria-current={active ? 'page' : undefined}
              className={cn(
                'group relative flex items-center gap-3 rounded-xl border-2 px-3.5 py-2 text-sm transition-all duration-200',
                active
                  ? 'border-ink bg-primary font-semibold text-white shadow-pop-sm'
                  : 'border-transparent text-foreground/75 hover:translate-x-0.5 hover:bg-primary-soft hover:text-primary rtl:hover:-translate-x-0.5',
              )}
            >
              <Icon className={cn('h-4 w-4 shrink-0 transition-transform duration-200', !active && 'group-hover:scale-110')} aria-hidden />
              {t(labelKey)}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-border p-3">
        <Link href="/account" onClick={onNavigate} className="flex items-center gap-3 rounded-xl border border-border bg-background px-3 py-2 transition-colors hover:border-primary/40 hover:bg-primary-soft">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border-[1.5px] border-ink bg-primary text-white">
            <UserRound className="h-4 w-4" aria-hidden />
          </span>
          <span className="min-w-0">
            <span className="block truncate text-sm font-semibold">{user?.firstName} {user?.lastName}</span>
            <span className="block truncate text-xs text-muted-foreground">{user?.roleName}</span>
          </span>
        </Link>
        <button
          type="button"
          onClick={() => void logout()}
          className="mt-1 flex w-full items-center gap-3 rounded-xl px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <LogOut className="h-4 w-4 rtl:rotate-180" aria-hidden />
          {tc('logout')}
        </button>
      </div>
    </div>
  );
}

export function AdminShell({ children }: { children: ReactNode }) {
  const t = useTranslations('nav');
  const tc = useTranslations('common');
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  // Le panneau sort du bord de début de ligne : la gauche en français, la droite en arabe.
  const offscreen = isRtl(useLocale()) ? '100%' : '-100%';

  useEffect(() => setOpen(false), [pathname]);
  const current = NAV_ITEMS.find((i) => pathname === i.href || pathname.startsWith(`${i.href}/`));

  return (
    <div data-surface="app" className="min-h-screen bg-background lg:grid lg:grid-cols-[16rem_minmax(0,1fr)]">
      <aside className="sticky top-0 hidden h-screen border-e-2 border-ink bg-card lg:block">
        <SidebarContent />
      </aside>

      <AnimatePresence>
        {open && (
          <motion.div className="fixed inset-0 z-40 lg:hidden" role="dialog" aria-modal="true" aria-label={t('main')}>
            <motion.button
              type="button"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-ink/40 backdrop-blur-sm"
              aria-label={tc('close')}
              onClick={() => setOpen(false)}
            />
            <motion.div
              initial={{ x: offscreen }}
              animate={{ x: 0 }}
              exit={{ x: offscreen }}
              transition={{ type: 'tween', duration: 0.25, ease: 'easeOut' }}
              className="absolute inset-y-0 start-0 w-72 max-w-[85%] border-e-2 border-ink bg-card shadow-pop-lg [html[dir=rtl]_&]:right-0"
            >
              <SidebarContent onNavigate={() => setOpen(false)} />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex min-w-0 flex-col">
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between gap-2 border-b border-border bg-background/90 px-3 backdrop-blur sm:gap-3 sm:px-8">
          <div className="flex min-w-0 items-center gap-2">
            <button
              type="button"
              className="rounded-xl border-pop border-ink bg-card p-2 shadow-pop-sm lg:hidden"
              aria-label={open ? tc('close') : t('openMenu')}
              aria-expanded={open}
              onClick={() => setOpen((v) => !v)}
            >
              {open ? <X className="h-5 w-5" aria-hidden /> : <Menu className="h-5 w-5" aria-hidden />}
            </button>
            <nav aria-label={t('breadcrumb')} className="truncate font-display text-sm font-bold text-ink">
              {current ? t(current.labelKey) : pathname.startsWith('/account') ? t('account') : ''}
            </nav>
          </div>
          <div className="flex shrink-0 items-center gap-1.5 sm:gap-3">
            <CommandPalette />
            <NotificationBell />
            <LanguageSwitcher />
          </div>
        </header>
        <motion.main
          key={pathname}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.22, ease: 'easeOut' }}
          className="flex-1 px-4 py-8 sm:px-8"
        >
          {children}
        </motion.main>
      </div>
    </div>
  );
}
