'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { LogOut, Menu, UserRound, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useEffect, useState, type ReactNode } from 'react';
import { useAgency } from '@/features/auth/use-agency';
import { useAuth } from '@/features/auth/auth-context';
import { Link, usePathname } from '@/i18n/navigation';
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
  const items = NAV_ITEMS.filter((i) => (!i.permission || can(i.permission)) && (!i.platformAdminOnly || user?.isPlatformAdmin));

  return (
    <div className="flex h-full flex-col">
      <div className="flex h-16 items-center border-b border-border px-5">
        <span className="truncate text-base font-semibold tracking-tight text-navy">{agency.data?.name ?? 'Study in World'}</span>
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
                'group relative flex items-center gap-3 rounded-full px-3.5 py-2 text-sm transition-all duration-200',
                active ? 'bg-primary font-medium text-white shadow-sm shadow-primary/25' : 'text-foreground/75 hover:bg-primary-soft hover:text-primary',
              )}
            >
              <Icon className={cn('h-4 w-4 shrink-0 transition-transform duration-200', !active && 'group-hover:scale-110')} aria-hidden />
              {t(labelKey)}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-border p-3">
        <Link href="/account" onClick={onNavigate} className="flex items-center gap-3 rounded-full px-3 py-2 transition-colors hover:bg-muted">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary-soft text-primary">
            <UserRound className="h-4 w-4" aria-hidden />
          </span>
          <span className="min-w-0">
            <span className="block truncate text-sm font-medium">{user?.firstName} {user?.lastName}</span>
            <span className="block truncate text-xs text-muted-foreground">{user?.roleName}</span>
          </span>
        </Link>
        <button
          type="button"
          onClick={() => void logout()}
          className="mt-1 flex w-full items-center gap-3 rounded-full px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
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

  useEffect(() => setOpen(false), [pathname]);
  const current = NAV_ITEMS.find((i) => pathname === i.href || pathname.startsWith(`${i.href}/`));

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[16rem_minmax(0,1fr)]">
      <aside className="sticky top-0 hidden h-screen border-e border-border bg-card lg:block">
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
              className="absolute inset-0 bg-navy/50"
              aria-label={tc('close')}
              onClick={() => setOpen(false)}
            />
            <motion.div
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'tween', duration: 0.25, ease: 'easeOut' }}
              className="absolute inset-y-0 start-0 w-72 max-w-[85%] bg-card shadow-xl [html[dir=rtl]_&]:right-0"
            >
              <SidebarContent onNavigate={() => setOpen(false)} />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex min-w-0 flex-col">
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between gap-3 border-b border-border bg-background/90 px-4 backdrop-blur sm:px-8">
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="rounded-md p-2 hover:bg-muted lg:hidden"
              aria-label={open ? tc('close') : t('openMenu')}
              aria-expanded={open}
              onClick={() => setOpen((v) => !v)}
            >
              {open ? <X className="h-5 w-5" aria-hidden /> : <Menu className="h-5 w-5" aria-hidden />}
            </button>
            <nav aria-label={t('breadcrumb')} className="text-sm text-muted-foreground">
              {current ? t(current.labelKey) : pathname.startsWith('/account') ? t('account') : ''}
            </nav>
          </div>
          <div className="flex items-center gap-3">
            <CommandPalette />
            <NotificationBell />
            <LanguageSwitcher />
          </div>
        </header>
        <motion.main
          key={pathname}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25, ease: 'easeOut' }}
          className="flex-1 px-4 py-8 sm:px-8"
        >
          {children}
        </motion.main>
      </div>
    </div>
  );
}
