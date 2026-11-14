// Logique pure des widgets du tableau de bord du portail candidat (lancée par `npm run test:unit`).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { candidateJourney, checklistCompletion, outstandingBalance } from '../../src/lib/portal-progress.ts';

const item = (status) => ({ status });
const inv = (status, currency, lines, paid = []) => ({
  status,
  currency,
  items: lines.map(([quantity, unitPrice]) => ({ quantity, unitPrice })),
  payments: paid.map((amount) => ({ amount })),
});

test('checklistCompletion : liste vide → null (jamais NaN)', () => {
  assert.equal(checklistCompletion([]), null);
});

test('checklistCompletion : fait et non applicable comptent comme terminés', () => {
  assert.equal(checklistCompletion([item('DONE'), item('NOT_APPLICABLE'), item('PENDING'), item('PENDING')]), 50);
  assert.equal(checklistCompletion([item('DONE'), item('DONE'), item('PENDING')]), 67);
});

test('outstanding ignore payées, brouillons et annulées', () => {
  const result = outstandingBalance([
    inv('ISSUED', 'TND', [[2, 300]], [100]),
    inv('PAID', 'TND', [[1, 900]], [900]),
    inv('DRAFT', 'TND', [[1, 400]]),
    inv('CANCELLED', 'TND', [[1, 700]]),
  ]);
  assert.deepEqual(result, [{ currency: 'TND', amount: 500 }]);
});

test('outstanding sépare les devises', () => {
  const result = outstandingBalance([
    inv('ISSUED', 'TND', [[1, 200]]),
    inv('PARTIALLY_PAID', 'EUR', [[1, 100]], [50]),
  ]);
  assert.deepEqual(result, [
    { currency: 'EUR', amount: 50 },
    { currency: 'TND', amount: 200 },
  ]);
});

test('outstanding : facture partiellement payée mais soldée → rien à payer', () => {
  assert.deepEqual(outstandingBalance([inv('PARTIALLY_PAID', 'TND', [[1, 300]], [100, 200])]), []);
});

test('candidateJourney : aucune donnée → admission en cours', () => {
  assert.deepEqual(candidateJourney([], []), { admission: 'current', visa: 'upcoming', departure: 'upcoming' });
});

test('candidateJourney : candidature non acceptée → admission en cours', () => {
  assert.deepEqual(candidateJourney([{ status: 'SUBMITTED' }], [{ status: 'PREPARING' }]), { admission: 'current', visa: 'upcoming', departure: 'upcoming' });
});

test('candidateJourney : acceptée, visa non approuvé → visa en cours', () => {
  assert.deepEqual(candidateJourney([{ status: 'REJECTED' }, { status: 'ACCEPTED' }], [{ status: 'SUBMITTED' }]), { admission: 'done', visa: 'current', departure: 'upcoming' });
});

test('candidateJourney : acceptée et visa approuvé → départ en cours', () => {
  assert.deepEqual(candidateJourney([{ status: 'ACCEPTED' }], [{ status: 'APPROVED' }]), { admission: 'done', visa: 'done', departure: 'current' });
});

test('candidateJourney : visa approuvé sans candidature acceptée → départ en cours', () => {
  assert.deepEqual(candidateJourney([], [{ status: 'APPROVED' }]), { admission: 'done', visa: 'done', departure: 'current' });
});
