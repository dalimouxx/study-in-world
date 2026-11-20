// Chaque code de problème du Health Score produit par l'API doit avoir sa traduction en français ET en arabe
// (candidates.healthIssues.<CODE>), sinon la version arabe retombe sur le message français brut.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const service = readFileSync(new URL('../../../api/src/health-score/health-score.service.ts', import.meta.url), 'utf8');
const codes = [...new Set([...service.matchAll(/code: '([A-Z_]+)'/g)].map((m) => m[1]))];
const load = (l) => JSON.parse(readFileSync(new URL(`../../messages/${l}.json`, import.meta.url), 'utf8'));

test('la liste des codes est bien lue depuis le service', () => {
  assert.ok(codes.length >= 10, `seulement ${codes.length} codes trouvés`);
});

for (const locale of ['fr', 'ar']) {
  test(`toutes les traductions des problèmes existent en ${locale}`, () => {
    const issues = load(locale).candidates?.healthIssues ?? {};
    const missing = codes.filter((c) => typeof issues[c] !== 'string');
    assert.deepEqual(missing, []);
  });
}
