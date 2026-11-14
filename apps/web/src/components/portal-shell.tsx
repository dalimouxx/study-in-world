'use client';

import { motion } from 'framer-motion';
import { CalendarDays, FileSignature, FileText, GraduationCap, House, LogOut, MessageCircle, Stamp, UserRound, Wallet } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { ReactNode } from 'react';
import { usePortalAuth } from '@/features/portal-auth/portal-auth-context';
import { StudyWorldLogo } from './study-world-logo';
import { Link, usePathname } from '@/i18n/navigation';
import { cn } from '@/lib/utils';
import { LanguageSwitcher } from './language-switcher';
import { PortalBottomNav, type PortalNavItem } from './portal-bottom-nav';

export const PORTAL_NAV: PortalNavItem[] = [
  { href: '/portal/dashboard', labelKey: 'dashboard', icon: House },
  { href: '/portal/profile', labelKey: 'profile', icon: UserRound },
  { href: '/portal/documents', labelKey: 'documents', icon: FileText },
  { href: '/portal/applications', labelKey: 'applications', icon: GraduationCap },
  { href: '/portal/visa', labelKey: 'visa', icon: Stamp },
  { href: '/portal/finance', labelKey: 'finance', icon: Wallet },
  { href: '/portal/contracts', labelKey: 'contracts', icon: FileSignature },
  { href: '/portal/appointments', labelKey: 'appointments', icon: CalendarDays },
  { href: '/portal/messages', labelKey: 'messages', icon: MessageCircle },
];

/** Portail candidat Bento Pop (intensité adoucie) : pensé téléphone d'abord, avec une barre de navigation en bas. */
export function PortalShell({ children }: { children: ReactNode }) {
  const t = useTranslations('portal');
  const pathname = usePathname();
  const { candidate, logout } = usePortalAuth();

  return (
    <div data-surface="app" className="min-h-screen bg-background">
      <header className="px-3 pt-3 sm:px-6 sm:pt-4">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 rounded-tile border-pop border-ink bg-card px-4 py-3 shadow-pop sm:px-5">
          <StudyWorldLogo />
          <div className="flex items-center gap-3">
            <span className="hidden text-sm font-semibold text-ink sm:inline">{candidate?.firstName} {candidate?.lastName}</span>
            <LanguageSwitcher />
            <button
              type="button"
              onClick={() => void logout()}
              aria-label={t('logout')}
              className="pop pop-hover inline-flex h-8 items-center gap-1.5 rounded-xl bg-card px-2.5 text-sm font-semibold text-ink sm:px-3"
            >
              <LogOut className="h-3.5 w-3.5 rtl:rotate-180" aria-hidden />
              <span className="hidden sm:inline">{t('logout')}</span>
            </button>
          </div>
        </div>
        <nav aria-label={t('title')} className="mx-auto hidden max-w-5xl gap-2 overflow-x-auto px-1 py-3 text-sm md:flex">
          {PORTAL_NAV.map(({ href, labelKey }) => {
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
        className="mx-auto max-w-5xl px-4 pb-28 pt-6 sm:px-6 md:pb-8"
      >
        {children}
      </motion.main>
      <PortalBottomNav items={PORTAL_NAV} />
    </div>
  );
}
