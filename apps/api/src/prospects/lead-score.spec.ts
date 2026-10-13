import { computeLeadScore } from './prospects.service';

const base = { budget: null, desiredCountryId: null, desiredProgram: null, email: null, assignedToId: null, status: 'NEW' as const, nextFollowUpAt: null };

describe('computeLeadScore', () => {
  it('un prospect sans aucune information est froid (0)', () => {
    expect(computeLeadScore(base)).toEqual({ score: 0, category: 'cold' });
  });

  it('budget + destination + email + assigné + qualifié + relance future → chaud', () => {
    const { score, category } = computeLeadScore({
      ...base, budget: 5000, desiredCountryId: 'c1', email: 'a@a.tn', assignedToId: 'u1', status: 'QUALIFIED',
      nextFollowUpAt: new Date(Date.now() + 86_400_000),
    });
    expect(score).toBeGreaterThanOrEqual(65);
    expect(category).toBe('hot');
  });

  it('une relance en retard pénalise le score plutôt que de l’améliorer', () => {
    const onTime = computeLeadScore({ ...base, budget: 1000, nextFollowUpAt: new Date(Date.now() + 86_400_000) });
    const late = computeLeadScore({ ...base, budget: 1000, nextFollowUpAt: new Date(Date.now() - 86_400_000) });
    expect(late.score).toBeLessThan(onTime.score);
  });

  it('le score ne dépasse jamais 100 ni ne descend sous 0', () => {
    const maxed = computeLeadScore({
      budget: 100000, desiredCountryId: 'c1', desiredProgram: 'Master', email: 'a@a.tn', assignedToId: 'u1',
      status: 'QUALIFIED', nextFollowUpAt: new Date(Date.now() + 86_400_000),
    });
    expect(maxed.score).toBeLessThanOrEqual(100);
    const minned = computeLeadScore({ ...base, nextFollowUpAt: new Date(Date.now() - 86_400_000) });
    expect(minned.score).toBeGreaterThanOrEqual(0);
  });
});
