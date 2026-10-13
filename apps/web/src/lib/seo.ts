import type { Metadata } from 'next';
import { siteUrl } from './site-url';

const LOCALES = ['fr', 'ar'] as const;
const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api';

/** Utilisé par les pages dynamiques (destination/université/programme) pour construire un titre réel côté serveur. */
export async function fetchPublicEntity<T>(path: string): Promise<T | null> {
  try {
    const res = await fetch(`${API_BASE}${path}`, { next: { revalidate: 3600 } });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

/**
 * Métadonnées communes à toute page publique indexable. Le layout racine mène par défaut à
 * `robots: { index: false }` (nécessaire pour l'admin et les portails) ; chaque page du site
 * public doit explicitement repasser en `index: true` via cette fonction, sans quoi elle reste
 * invisible des moteurs de recherche même si elle figure dans le sitemap.
 */
export function publicMetadata({
  locale, path, title, description,
}: { locale: string; path: string; title: string; description: string }): Metadata {
  const base = siteUrl();
  const canonical = `${base}/${locale}${path}`;
  return {
    title,
    description,
    alternates: {
      canonical,
      languages: Object.fromEntries(LOCALES.map((l) => [l, `${base}/${l}${path}`])),
    },
    robots: { index: true, follow: true },
    openGraph: { title, description, url: canonical, locale, type: 'website' },
    twitter: { card: 'summary', title, description },
  };
}
