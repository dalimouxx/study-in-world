// Heure saisie dans un champ « date et heure » : c'est l'heure locale de l'employé, jamais celle du serveur.
// Sans conversion, « 23:30 » était enregistré 23:30 UTC (00:30 le lendemain à Tunis) et les rappels
// envoyés aux clients affichaient une heure fausse.
import { test } from 'node:test';
import assert from 'node:assert/strict';

process.env.TZ = 'Africa/Tunis'; // le navigateur de l'agence (UTC+1)
const { isoToLocalInput, localInputToIso } = await import('../../src/lib/local-datetime.ts');

test('la saisie locale 23:30 est envoyée comme 22:30 UTC', () => {
  assert.equal(localInputToIso('2026-11-20T23:30'), '2026-11-20T22:30:00.000Z');
});

test('champ vide → undefined (rien envoyé)', () => {
  assert.equal(localInputToIso(''), undefined);
});

test('une date enregistrée revient à l’heure locale dans le champ', () => {
  assert.equal(isoToLocalInput('2026-11-20T22:30:00.000Z'), '2026-11-20T23:30');
  assert.equal(isoToLocalInput(null), '');
});
