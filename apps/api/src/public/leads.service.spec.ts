import { LeadsService } from './leads.service';

function build() {
  const prisma = {
    organization: { findFirst: jest.fn().mockResolvedValue({ id: 'orgA' }) },
    country: { findFirst: jest.fn() },
    prospect: { create: jest.fn().mockImplementation(({ data }: { data: unknown }) => Promise.resolve({ id: 'p1', ...(data as object) })) },
  };
  const timeline = { add: jest.fn().mockResolvedValue(undefined) };
  return { service: new LeadsService(prisma as never, timeline as never), prisma };
}

describe('LeadsService.create', () => {
  it('ne fait rien si l’agence (slug) est introuvable — jamais d’erreur exposée au visiteur', async () => {
    const { service, prisma } = build();
    prisma.organization.findFirst.mockResolvedValue(null);
    await expect(service.create('unknown-slug', { firstName: 'A', lastName: 'B', phone: '123' })).resolves.toBeUndefined();
    expect(prisma.prospect.create).not.toHaveBeenCalled();
  });

  it('transmet les réponses du simulateur (destination, programme, budget, campagne) au prospect créé', async () => {
    const { service, prisma } = build();
    prisma.country.findFirst.mockResolvedValue({ id: 'c1' });
    await service.create('siw', {
      firstName: 'Ali', lastName: 'Ben', phone: '20123456', desiredCountryId: 'c1', desiredProgram: 'Master Informatique', budget: 8000, campaign: 'simulateur-eligibilite',
    });
    expect(prisma.prospect.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ desiredCountryId: 'c1', desiredProgram: 'Master Informatique', budget: 8000, campaign: 'simulateur-eligibilite' }),
    }));
  });

  it('ignore silencieusement un desiredCountryId qui n’appartient pas à cette agence, sans faire échouer la création', async () => {
    const { service, prisma } = build();
    prisma.country.findFirst.mockResolvedValue(null); // pays d'une autre organisation, ou inexistant
    await service.create('siw', { firstName: 'Ali', lastName: 'Ben', phone: '20123456', desiredCountryId: 'country-from-another-org' });
    expect(prisma.prospect.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ desiredCountryId: undefined }) }));
  });
});
