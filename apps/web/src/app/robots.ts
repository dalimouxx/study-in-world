import type { MetadataRoute } from 'next';
import { siteUrl } from '@/lib/site-url';

// Chemins privés (admin, portails candidat/partenaire, connexion) — jamais indexés, quelle que soit la langue.
const PRIVATE_PATHS = [
  'dashboard', 'command-center', 'prospects', 'candidates', 'catalog', 'automation', 'reports', 'partners',
  'tasks', 'appointments', 'cashbox', 'expenses', 'employees', 'roles', 'branches', 'settings', 'logs', 'account',
  'login', 'forgot-password', 'reset-password', 'portal', 'partner-portal',
];

export default function robots(): MetadataRoute.Robots {
  const disallow = ['fr', 'ar'].flatMap((locale) => PRIVATE_PATHS.map((p) => `/${locale}/${p}`));
  return {
    rules: { userAgent: '*', allow: '/', disallow },
    sitemap: `${siteUrl()}/sitemap.xml`,
  };
}
