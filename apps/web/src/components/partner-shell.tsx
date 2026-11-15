'use client';

import { motion } from 'framer-motion';
import { LogOut } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { ReactNode } from 'react';
import { usePartnerAuth } from '@/features/partner-auth/partner-auth-context';
import { StudyWorldLogo } from './study-world-logo';
import { Link, usePathname } from '@/i18n/navigation';
import { cn } from '@/lib/utils';
import { LanguageSwitcher } from './language-switcher';

const NAV = [
  { href: '/partner-portal/dashboard' as const, labelKey: 'dashboard' },
  { href: '/partner-portal/candidates' as const, labelKey: 'candidates' },
  { href: '/partner-portal/commissions' as const, labelKey: 'commissions' },
];

export function PartnerShell({ children }: { children: ReactNode }) {
  const t = useTranslations('partnerPortal');
  const pathname = usePathname();
  const { partnerUser, logout } = usePartnerAuth();

  return (
    <div data-surface="app" className="min-h-screen bg-background">
      <header className="px-4 pt-4 sm:px-6">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 rounded-tile border-pop border-ink bg-card px-5 py-3 shadow-pop">
          <StudyWorldLogo />
          <div className="flex items-center gap-3">
            <span className="text-sm text-muted-foreground">{partnerUser?.firstName} {partnerUser?.lastName}</span>
            <LanguageSwitcher />
            <button
              type="button"
              onClick={() => void logout()}
              className="pop pop-hover inline-flex h-8 items-center gap-1.5 rounded-xl bg-card px-3 text-sm font-semibold text-ink"
            >
              <LogOut className="h-3.5 w-3.5 rtl:rotate-180" aria-hidden />
              {t('logout')}
            </button>
          </div>
        </div>
        <nav aria-label={t('title')} className="mx-auto flex max-w-5xl gap-2 overflow-x-auto px-1 py-3 text-sm">
          {NAV.map(({ href, labelKey }) => {
            const active = pathname === href;
            return (
              <Link
                key={href}
                href={href}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'shrink-0 whitespace-nowrap rounded-xl border-2 px-3.5 py-1.5 font-semibold transition-all duration-200',
                  active ? 'border-ink bg-primary text-white shadow-pop-sm' : 'border-transparent text-ink/70 hover:bg-primary-soft hover:text-primary',
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
        transition={{ duration: 0.22, ease: 'easeOut' }}
        className="mx-auto max-w-5xl px-4 py-6 sm:px-6"
      >
        {children}
      </motion.main>
    </div>
  );
}
