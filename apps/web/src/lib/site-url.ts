/**
 * URL absolue du site public, utilisée pour le sitemap, robots.txt et les balises canoniques/Open Graph.
 * À définir en production via NEXT_PUBLIC_SITE_URL — retombe sur localhost en développement.
 */
export function siteUrl(): string {
  return (process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000').replace(/\/$/, '');
}
