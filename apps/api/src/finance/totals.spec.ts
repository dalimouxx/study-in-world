import { computeTotals, documentTotals, NO_TAXES, type TaxSettings } from './totals';

const ON: TaxSettings = { taxesEnabled: true, vatRate: 19, stampDuty: 1 };

describe('computeTotals', () => {
  it('services seuls : TVA 19 % et timbre', () => {
    expect(computeTotals([{ kind: 'SERVICE', quantity: 1, unitPrice: 2000 }], ON)).toEqual({ subtotal: 2000, vatAmount: 380, disbursements: 0, stampDuty: 1, total: 2381 });
  });

  it('services + débours (exemple de la conception)', () => {
    const t = computeTotals([{ kind: 'SERVICE', quantity: 1, unitPrice: 2000 }, { kind: 'DISBURSEMENT', quantity: 1, unitPrice: 1500 }], ON);
    expect(t).toEqual({ subtotal: 2000, vatAmount: 380, disbursements: 1500, stampDuty: 1, total: 3881 });
  });

  it('débours seuls : pas de TVA, mais le timbre', () => {
    expect(computeTotals([{ kind: 'DISBURSEMENT', quantity: 2, unitPrice: 750 }], ON)).toEqual({ subtotal: 0, vatAmount: 0, disbursements: 1500, stampDuty: 1, total: 1501 });
  });

  it('arrondi au millime', () => {
    const t = computeTotals([{ kind: 'SERVICE', quantity: 3, unitPrice: 45.5 }], ON);
    expect(t.vatAmount).toBe(25.935);
    expect(t.total).toBe(163.435);
  });

  it('taxes désactivées : somme brute, sans TVA ni timbre', () => {
    const t = computeTotals([{ kind: 'SERVICE', quantity: 1, unitPrice: 100 }, { kind: 'DISBURSEMENT', quantity: 1, unitPrice: 50 }], NO_TAXES);
    expect(t).toEqual({ subtotal: 100, vatAmount: 0, disbursements: 50, stampDuty: 0, total: 150 });
  });

  it('une ligne sans type est un service', () => {
    expect(computeTotals([{ quantity: 1, unitPrice: 100 }], ON).vatAmount).toBe(19);
  });
});

describe('documentTotals', () => {
  it('document ancien (total vide) : somme brute, jamais taxé', () => {
    const t = documentTotals({ items: [{ quantity: 1, unitPrice: 500 }, { quantity: 2, unitPrice: 100 }], total: null });
    expect(t).toEqual({ subtotal: 700, vatAmount: 0, disbursements: 0, stampDuty: 0, total: 700, taxed: false });
  });

  it('document enregistré : renvoie les totaux enregistrés', () => {
    const t = documentTotals({
      items: [{ kind: 'SERVICE', quantity: 1, unitPrice: 2000 }, { kind: 'DISBURSEMENT', quantity: 1, unitPrice: 1500 }],
      subtotal: 2000, vatAmount: 380, disbursements: 1500, stampDuty: 1, total: 3881,
    });
    expect(t).toEqual({ subtotal: 2000, vatAmount: 380, disbursements: 1500, stampDuty: 1, total: 3881, taxed: true });
  });

  it('document enregistré sans taxes (agence non assujettie) : non taxé', () => {
    const t = documentTotals({ items: [{ kind: 'SERVICE', quantity: 1, unitPrice: 100 }], subtotal: 100, vatAmount: 0, disbursements: 0, stampDuty: 0, total: 100 });
    expect(t.taxed).toBe(false);
  });
});
