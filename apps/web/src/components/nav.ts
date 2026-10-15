import {
  BarChart3, Building2, CalendarDays, CheckSquare, GraduationCap, Gauge, Handshake, KeyRound, LayoutDashboard,
  Newspaper, PiggyBank, ScrollText, Settings, ShieldCheck, Sparkles, UserPlus, Users, Wallet, Zap, type LucideIcon,
} from 'lucide-react';

export interface NavItem {
  href: '/dashboard' | '/prospects' | '/candidates' | '/tasks' | '/appointments' | '/cashbox' | '/expenses'
    | '/catalog' | '/automation' | '/reports' | '/command-center' | '/partners' | '/employees' | '/roles'
    | '/branches' | '/settings' | '/logs' | '/blog-admin' | '/platform-admin' | '/site-admin';
  labelKey: string;
  icon: LucideIcon;
  permission?: string;
  /** Réservé à /platform-admin : n'apparaît que si l'utilisateur a isPlatformAdmin, jamais via le RBAC normal. */
  platformAdminOnly?: boolean;
  /** Réservé au rôle Super Admin (RBAC normal, mais exclusivement ce rôle) — voir SuperAdminGuard côté API. */
  superAdminOnly?: boolean;
}

/** Seuls les modules réellement livrés apparaissent : aucun lien vers une page qui n'existe pas encore. */
export const NAV_ITEMS: NavItem[] = [
  { href: '/dashboard', labelKey: 'dashboard', icon: LayoutDashboard },
  { href: '/command-center', labelKey: 'commandCenter', icon: Gauge, permission: 'command_center.view' },
  { href: '/prospects', labelKey: 'prospects', icon: UserPlus, permission: 'prospect.view' },
  { href: '/candidates', labelKey: 'candidates', icon: Users, permission: 'candidate.view' },
  { href: '/catalog', labelKey: 'catalog', icon: GraduationCap, permission: 'catalog.view' },
  { href: '/partners', labelKey: 'partners', icon: Handshake, permission: 'partner.view' },
  { href: '/blog-admin', labelKey: 'blog', icon: Newspaper, permission: 'blog.view' },
  { href: '/tasks', labelKey: 'tasks', icon: CheckSquare, permission: 'task.view' },
  { href: '/appointments', labelKey: 'appointments', icon: CalendarDays, permission: 'appointment.view' },
  { href: '/cashbox', labelKey: 'cashbox', icon: Wallet, permission: 'cashbox.manage' },
  { href: '/expenses', labelKey: 'expenses', icon: PiggyBank, permission: 'expense.manage' },
  { href: '/reports', labelKey: 'reports', icon: BarChart3, permission: 'finance.view' },
  { href: '/automation', labelKey: 'automation', icon: Zap, permission: 'automation.view' },
  { href: '/employees', labelKey: 'employees', icon: Users, permission: 'employee.view' },
  { href: '/roles', labelKey: 'roles', icon: KeyRound, permission: 'role.view' },
  { href: '/branches', labelKey: 'branches', icon: Building2, permission: 'branch.view' },
  { href: '/settings', labelKey: 'settings', icon: Settings, permission: 'settings.view' },
  { href: '/site-admin', labelKey: 'siteAdmin', icon: Sparkles, superAdminOnly: true },
  { href: '/logs', labelKey: 'logs', icon: ScrollText, permission: 'audit.view' },
  { href: '/platform-admin', labelKey: 'platformAdmin', icon: ShieldCheck, platformAdminOnly: true },
];
