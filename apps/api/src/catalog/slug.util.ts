/** Génère un slug URL-safe à partir d'un nom (minuscules, tirets, sans accents). */
export function slugify(input: string): string {
  return input
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

/** Ajoute -2, -3... jusqu'à trouver un slug libre (unicité vérifiée par le callback fourni). */
export async function generateUniqueSlug(base: string, exists: (slug: string) => Promise<boolean>): Promise<string> {
  const root = slugify(base) || 'item';
  let candidate = root;
  let i = 2;
  while (await exists(candidate)) {
    candidate = `${root}-${i++}`;
  }
  return candidate;
}
