// Lien WhatsApp des relances : texte prêt à envoyer, jamais de lien pour un numéro inexploitable.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildWhatsappUrl } from '../../src/lib/reminder-text.ts';

test('construit un lien wa.me avec le texte encodé (arabe compris)', () => {
  const url = buildWhatsappUrl('+216 20 000 000', 'مرحبًا ياسمين');
  assert.ok(url.startsWith('https://wa.me/21620000000?text='));
  assert.equal(decodeURIComponent(url.split('text=')[1]), 'مرحبًا ياسمين');
});

test('aucun lien pour un téléphone vide ou trop court', () => {
  assert.equal(buildWhatsappUrl('', 'x'), null);
  assert.equal(buildWhatsappUrl(null, 'x'), null);
  assert.equal(buildWhatsappUrl('12 34', 'x'), null);
});
