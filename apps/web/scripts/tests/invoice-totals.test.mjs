// Aperçu des totaux dans le formulaire de devis/facture (même règle que l'API, lancée par `npm run test:unit`).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { previewTotals } from '../../src/lib/invoice-totals.ts';

const ON = { taxesEnabled: true, vatRate: 19, stampDuty: 1 };

test('services seuls : TVA 19 % et timbre', () => {
  assert.deepEqual(previewTotals([{ kind: 'SERVICE', quantity: 1, unitPrice: 2000 }], ON), { subtotal: 2000, vatAmount: 380, disbursements: 0, stampDuty: 1, total: 2381 });
});

test('services + débours', () => {
  assert.equal(previewTotals([{ kind: 'SERVICE', quantity: 1, unitPrice: 2000 }, { kind: 'DISBURSEMENT', quantity: 1, unitPrice: 1500 }], ON).total, 3881);
});

test('arrondi au millime', () => {
  const t = previewTotals([{ kind: 'SERVICE', quantity: 3, unitPrice: 45.5 }], ON);
  assert.equal(t.vatAmount, 25.935);
  assert.equal(t.total, 163.435);
});

test('saisie incomplète (prix vide) : comptée à 0, jamais NaN', () => {
  assert.equal(previewTotals([{ kind: 'SERVICE', quantity: 1, unitPrice: Number.NaN }], ON).total, 1);
});
