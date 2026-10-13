'use client';

import { motion } from 'framer-motion';
import { LogOut } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { ReactNode } from 'react';
import { usePortalAuth } from '@/features/portal-auth/portal-auth-context';
import { StudyWorldLogo } from './study-world-logo';
import { Link, usePathname } from '@/i18n/navigation';
import { cn } from '@/lib/utils';
import { LanguageSwitcher } from './language-switcher';

const NAV = [
  { href: '/portal/dashboard' as const, labelKey: 'dashboard' },
  { href: '/portal/profile' as const, labelKey: 'profile' },
  { href: '/portal/documents' as const, labelKey: 'documents' },
  { href: '/portal/applications' as const, labelKey: 'applications' },
  { href: '/portal/visa' as const, labelKey: 'visa' },
  { href: '/portal/finance' as const, labelKey: 'finance' },
  { href: '/portal/contracts' as const, labelKey: 'contracts' },
  { href: '/portal/appointments' as const, labelKey: 'appointments' },
  { href: '/portal/messages' as const, labelKey: 'messages' },
];

/** Palier « 50% Premium Travel Editorial » (voir README) : plus chaleureux que l'admin, mais reste simple à utiliser. */
export function PortalShell({ children }: { children: ReactNode }) {
  const t = useTranslations('portal');
  const pathname = usePathname();
  const { candidate, logout } = usePortalAuth();

  return (
    <div className="min-h-screen bg-sw-bg-light">
      <header className="border-b border-primary/10 bg-white">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-6 py-4">
          <StudyWorldLogo />
          <div className="flex items-center gap-3">
            <span className="text-sm text-muted-foreground">{candidate?.firstName} {candidate?.lastName}</span>
            <LanguageSwitcher />
            <button
              type="button"
              onClick={() => void logout()}
              className="inline-flex h-8 items-center gap-1.5 rounded-full border border-primary/20 bg-white px-3 text-sm font-medium text-primary transition-colors hover:bg-primary-soft"
            >
              <LogOut className="h-3.5 w-3.5 rtl:rotate-180" aria-hidden />
              {t('logout')}
            </button>
          </div>
        </div>
        <nav aria-label={t('title')} className="mx-auto flex max-w-5xl gap-1.5 overflow-x-auto px-6 pb-3 text-sm">
          {NAV.map(({ href, labelKey }) => {
            const active = pathname === href;
            return (
              <Link
                key={href}
                href={href}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'shrink-0 rounded-full px-3.5 py-1.5 whitespace-nowrap transition-all duration-200',
                  active ? 'bg-primary text-white shadow-sm shadow-primary/25' : 'text-navy/70 hover:bg-primary-soft hover:text-primary',
                )}
              >
                {t(labelKey)}
              </Link>
            );
          })}
        </nav>
      </header>
      <motion.main
        key={pathname}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, ease: 'easeOut' }}
        className="mx-auto max-w-5xl px-6 py-8"
      >
        {children}
      </motion.main>
    </div>
  );
}
