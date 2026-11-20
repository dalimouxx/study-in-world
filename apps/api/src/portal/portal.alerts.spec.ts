import { PortalService } from './portal.service';

const candidate = { id: 'c1', organizationId: 'orgA', email: 'y@demo.tn', firstName: 'Yasmine', lastName: 'Ben Ali' };

describe('PortalService — alertes Telegram', () => {
  const setup = () => {
    const messages = { sendFromCandidate: jest.fn().mockResolvedValue({ id: 'm1' }) };
    const alerts = { emit: jest.fn() };
    const service = new PortalService({} as never, {} as never, {} as never, {} as never, messages as never, {} as never, alerts as never);
    return { service, alerts };
  };

  it('message d’un candidat : alerte sans le contenu du message', async () => {
    const { service, alerts } = setup();
    await service.sendMessage(candidate, 'Mon numéro de passeport est X1234567');
    expect(alerts.emit).toHaveBeenCalledWith({ kind: 'portal_message', candidateId: 'c1', name: 'Yasmine Ben Ali' });
    expect(JSON.stringify(alerts.emit.mock.calls)).not.toContain('X1234567');
  });
});
