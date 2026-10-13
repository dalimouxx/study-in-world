import type { MetadataRoute } from 'next';
import { siteUrl } from '@/lib/site-url';

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api';
const LOCALES = ['fr', 'ar'] as const;

// Revalidation horaire : le catalogue change rarement assez pour justifier une génération à chaque requête de robot.
export const revalidate = 3600;

interface Country { slug: string }
interface University { slug: string }
interface Program { slug: string }

async function safeFetchJson<T>(path: string): Promise<T | null> {
  try {
    // Timeout court : sur une API en sommeil (hébergement gratuit), un fetch sans limite peut bloquer
    // la génération statique du sitemap bien au-delà des 60s que Vercel accorde à une route pendant le build.
    const res = await fetch(`${API_BASE}${path}`, { next: { revalidate }, signal: AbortSignal.timeout(8000) });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = siteUrl();
  const now = new Date();

  const entries: MetadataRoute.Sitemap = LOCALES.flatMap((locale) => [
    { url: `${base}/${locale}`, lastModified: now, changeFrequency: 'weekly', priority: 1 },
    { url: `${base}/${locale}/destinations`, lastModified: now, changeFrequency: 'weekly', priority: 0.8 },
    { url: `${base}/${locale}/programs`, lastModified: now, changeFrequency: 'weekly', priority: 0.8 },
    { url: `${base}/${locale}/eligibility`, lastModified: now, changeFrequency: 'monthly', priority: 0.7 },
  ]);

  const countries = (await safeFetchJson<Country[]>('/public/catalog/countries')) ?? [];
  for (const c of countries) {
    for (const locale of LOCALES) entries.push({ url: `${base}/${locale}/destinations/${c.slug}`, lastModified: now, changeFrequency: 'weekly', priority: 0.6 });
  }

  // Pas d'endpoint listant toutes les universités à plat : on les collecte via le détail de chaque pays.
  const universitySlugs = new Set<string>();
  for (const c of countries) {
    const detail = await safeFetchJson<{ universities?: University[] }>(`/public/catalog/countries/${c.slug}`);
    for (const u of detail?.universities ?? []) universitySlugs.add(u.slug);
  }
  for (const slug of universitySlugs) {
    for (const locale of LOCALES) entries.push({ url: `${base}/${locale}/universities/${slug}`, lastModified: now, changeFrequency: 'monthly', priority: 0.5 });
  }

  const programs = await safeFetchJson<{ items: Program[] }>('/public/catalog/programs?pageSize=500');
  for (const p of programs?.items ?? []) {
    for (const locale of LOCALES) entries.push({ url: `${base}/${locale}/programs/${p.slug}`, lastModified: now, changeFrequency: 'monthly', priority: 0.6 });
  }

  return entries;
}
