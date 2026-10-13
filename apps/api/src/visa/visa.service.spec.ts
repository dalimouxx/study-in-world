import { VisaService } from './visa.service';
import { DEFAULT_VISA_CHECKLIST } from '../checklist/checklist.service';
import type { AuthUser } from '../common/auth-user';

const actor = (): AuthUser => ({
  id: 'u1', organizationId: 'orgA', branchId: 'b1', email: 'a@a.tn', firstName: 'A', lastName: 'B',
  locale: 'fr', mustChangePassword: false, roleId: 'r1', roleCode: 'ADVISOR', roleName: 'Conseiller',
  permissions: ['visa.manage'],
  isPlatformAdmin: false,
});

function build() {
  const prisma = { visaFile: { create: jest.fn().mockResolvedValue({ id: 'v1', country: 'Italie' }), findFirst: jest.fn(), update: jest.fn() } };
  const candidates = { assertBelongs: jest.fn().mockResolvedValue(undefined) };
  const automation = { fire: jest.fn().mockResolvedValue(undefined) };
  const checklist = { seedDefaultVisaChecklist: jest.fn().mockResolvedValue({ count: DEFAULT_VISA_CHECKLIST.length }) };
  const audit = { log: jest.fn().mockResolvedValue(undefined) };
  const timeline = { add: jest.fn().mockResolvedValue(undefined) };
  return { service: new VisaService(prisma as never, candidates as never, automation as never, checklist as never, audit as never, timeline as never), prisma, checklist };
}

describe('VisaService.create', () => {
  it('pré-remplit la checklist standard à l’ouverture du dossier', async () => {
    const { service, checklist } = build();
    const created = await service.create(actor(), 'cand1', { country: 'Italie' }, {});
    expect(checklist.seedDefaultVisaChecklist).toHaveBeenCalledWith('orgA', 'cand1', 'v1');
    expect(created.id).toBe('v1');
  });
});
