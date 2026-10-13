// Vérifie que (1) fr.json et ar.json ont exactement les mêmes clés, (2) chaque clé statique utilisée dans le code existe,
// (3) aucune clé JSON ne contient un point littéral (next-intl les traite comme de l'imbrication, jamais comme un
// caractère normal — une clé "auth.login": "..." casse le chargement des messages au lieu de simplement ne pas marcher).
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const load = (l) => JSON.parse(readFileSync(`messages/${l}.json`, 'utf8'));
const flatten = (o, p = '') =>
  Object.entries(o).flatMap(([k, v]) => (v && typeof v === 'object' && !Array.isArray(v) ? flatten(v, `${p}${k}.`) : [`${p}${k}`]));
const findDottedKeys = (o, p = '') =>
  Object.entries(o).flatMap(([k, v]) => [
    ...(k.includes('.') ? [`${p}${k}`] : []),
    ...(v && typeof v === 'object' && !Array.isArray(v) ? findDottedKeys(v, `${p}${k}.`) : []),
  ]);
const fr = new Set(flatten(load('fr')));
const ar = new Set(flatten(load('ar')));
let errors = 0;
for (const k of fr) if (!ar.has(k)) (console.error(`ar.json : clé manquante ${k}`), errors++);
for (const k of ar) if (!fr.has(k)) (console.error(`fr.json : clé manquante ${k}`), errors++);

for (const [lang, data] of [['fr', load('fr')], ['ar', load('ar')]]) {
  for (const key of findDottedKeys(data)) {
    console.error(`${lang}.json : clé « ${key} » contient un point littéral — next-intl le lira comme de l'imbrication, pas comme un caractère (utilisez un objet imbriqué, ou remplacez le point par un underscore)`);
    errors++;
  }
}

const walk = (d) => readdirSync(d).flatMap((f) => (statSync(join(d, f)).isDirectory() ? walk(join(d, f)) : [join(d, f)]));
for (const file of walk('src').filter((f) => /\.tsx?$/.test(f))) {
  const src = readFileSync(file, 'utf8');
  const bindings = [...src.matchAll(/const\s+(\w+)\s*=\s*(?:await\s+)?useTranslations\('([\w.]+)'\)/g)];
  for (const [, v, ns] of bindings) {
    const re = new RegExp(`\\b${v}(?:\\.raw|\\.has)?\\(\\s*'([^']+)'`, 'g');
    for (const [, key] of src.matchAll(re)) {
      if (!fr.has(`${ns}.${key}`) && ![...fr].some((k) => k.startsWith(`${ns}.${key}.`))) {
        console.error(`${file} : clé inconnue ${ns}.${key}`);
        errors++;
      }
    }
  }
}
console.log(errors ? `${errors} erreur(s) i18n` : `i18n OK (${fr.size} clés, fr = ar)`);
process.exit(errors ? 1 : 0);
