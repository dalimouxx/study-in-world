// Aperçu en direct des modèles (Paramètres → Messages) : mêmes règles que le remplissage côté API.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renderTemplate } from '../../src/lib/render-template.ts';

test('remplace les variables', () => {
  assert.equal(renderTemplate('Bonjour {prenom}, RDV le {date} à {heure}', { prenom: 'Yasmine', date: '17/11/2026', heure: '10:00' }), 'Bonjour Yasmine, RDV le 17/11/2026 à 10:00');
});

test('variable inconnue retirée, jamais affichée', () => {
  const out = renderTemplate('Bonjour {prénom} !', {});
  assert.equal(out, 'Bonjour !');
  assert.ok(!out.includes('{'));
});

test('variable vide retirée avec son séparateur', () => {
  assert.equal(renderTemplate('Lieu : {lieu}', { lieu: '' }), 'Lieu');
  assert.equal(renderTemplate('Rendez-vous demain · {lieu}', {}), 'Rendez-vous demain');
});

test('garde les retours à la ligne et le texte arabe', () => {
  assert.equal(renderTemplate('مرحبًا {prenom}\nشكرًا', { prenom: 'ياسمين' }), 'مرحبًا ياسمين\nشكرًا');
});
