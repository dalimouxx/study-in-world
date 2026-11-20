import { alertText, type AlertEvent } from './alert-text';
import { AlertsService } from './alerts.service';

const BASE = 'https://studyinworld.net';

describe('alertText', () => {
  it('nouveau prospect : titre, nom échappé, lien vers les prospects', () => {
    const t = alertText({ kind: 'lead', name: 'Ali <b>Ben</b> & Co' }, BASE);
    expect(t).toContain('Nouveau prospect');
    expect(t).toContain('Ali &lt;b&gt;Ben&lt;/b&gt; &amp; Co');
    expect(t).toContain(`${BASE}/fr/prospects`);
  });

  it('document déposé : lien vers le dossier du candidat', () => {
    const t = alertText({ kind: 'portal_document', candidateId: 'c1', name: 'Yasmine Ben Ali', document: 'Passeport' }, BASE);
    expect(t).toContain('Document déposé');
    expect(t).toContain('Passeport');
    expect(t).toContain(`${BASE}/fr/candidates/c1`);
  });

  it('paiement : numéro de facture, jamais de montant', () => {
    const t = alertText({ kind: 'payment', candidateId: 'c1', name: 'Yasmine', invoiceNumber: 'FAC-2026-0003', by: 'Sami' }, BASE);
    expect(t).toContain('FAC-2026-0003');
    expect(t).not.toMatch(/TND|\d+\.\d{3}/);
  });

  it('message d’un candidat : jamais le contenu du message', () => {
    const t = alertText({ kind: 'portal_message', candidateId: 'c1', name: 'Yasmine' }, BASE);
    expect(t).toContain('Nouveau message');
  });

  it('erreur serveur : méthode, chemin et message tronqué', () => {
    const t = alertText({ kind: 'server_error', method: 'POST', path: '/api/invoices', message: 'x'.repeat(500) }, BASE);
    expect(t).toContain('POST /api/invoices');
    expect(t.length).toBeLessThan(500);
  });

  it('chaque type d’événement a un texte', () => {
    const events: AlertEvent[] = [
      { kind: 'lead', name: 'A' },
      { kind: 'portal_document', candidateId: 'c', name: 'A', document: 'D' },
      { kind: 'portal_message', candidateId: 'c', name: 'A' },
      { kind: 'contract_signed_online', candidateId: 'c', name: 'A', number: 'CTR-1' },
      { kind: 'partner_comment', candidateId: 'c', name: 'A', partner: 'P' },
      { kind: 'candidate_created', candidateId: 'c', name: 'A', by: 'B' },
      { kind: 'invoice', candidateId: 'c', name: 'A', invoiceNumber: 'FAC-1', by: 'B' },
      { kind: 'payment', candidateId: 'c', name: 'A', invoiceNumber: 'FAC-1', by: 'B' },
      { kind: 'server_error', method: 'GET', path: '/x', message: 'boom' },
    ];
    for (const e of events) expect(alertText(e, BASE).length).toBeGreaterThan(10);
  });
});

describe('AlertsService', () => {
  const config = (vals: Record<string, string | undefined>) => ({ get: (k: string) => vals[k] });
  const ON = { TELEGRAM_BOT_TOKEN: '123:abc', TELEGRAM_CHAT_ID: '-100', FRONTEND_URL: BASE };
  const flush = () => new Promise((r) => setImmediate(r));

  it('sans configuration Telegram : n’envoie rien', async () => {
    const fetchMock = jest.fn();
    const s = new AlertsService(config({}) as never, fetchMock as never);
    s.emit({ kind: 'lead', name: 'A' });
    await flush();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('envoie au groupe configuré, en HTML, sans aperçu de lien', async () => {
    const fetchMock = jest.fn().mockResolvedValue({ ok: true });
    const s = new AlertsService(config(ON) as never, fetchMock as never);
    s.emit({ kind: 'lead', name: 'A' });
    await flush();
    expect(fetchMock).toHaveBeenCalledWith('https://api.telegram.org/bot123:abc/sendMessage', expect.objectContaining({ method: 'POST' }));
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body).toMatchObject({ chat_id: '-100', parse_mode: 'HTML', disable_web_page_preview: true });
  });

  it('jamais bloquant : une panne de Telegram ne remonte pas', async () => {
    const fetchMock = jest.fn().mockRejectedValue(new Error('network'));
    const s = new AlertsService(config(ON) as never, fetchMock as never);
    expect(() => s.emit({ kind: 'lead', name: 'A' })).not.toThrow();
    await flush();
    expect(fetchMock).toHaveBeenCalled();
  });

  it('erreurs serveur : une seule alerte par erreur toutes les 10 minutes', async () => {
    const fetchMock = jest.fn().mockResolvedValue({ ok: true });
    let now = 1_000_000;
    const s = new AlertsService(config(ON) as never, fetchMock as never, () => now);
    const err = { kind: 'server_error' as const, method: 'GET', path: '/api/x', message: 'boom' };
    s.emit(err);
    s.emit(err);
    now += 9 * 60_000;
    s.emit(err);
    now += 2 * 60_000;
    s.emit(err);
    s.emit({ ...err, message: 'autre' });
    await flush();
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });
});

describe('ServerErrorAlertFilter', () => {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { ServerErrorAlertFilter } = require('./server-error.filter');
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { BadRequestException } = require('@nestjs/common');
  const setup = () => {
    const alerts = { emit: jest.fn() };
    const httpAdapter = { reply: jest.fn(), isHeadersSent: jest.fn().mockReturnValue(false), end: jest.fn() };
    const filter = new ServerErrorAlertFilter({ httpAdapter } as never, alerts as never);
    const req = { method: 'POST', originalUrl: '/api/invoices?email=a@b.tn' };
    const host = { getType: () => 'http', switchToHttp: () => ({ getRequest: () => req, getResponse: () => ({}) }), getArgByIndex: () => ({}) };
    return { filter, alerts, host, httpAdapter };
  };

  it('erreur inattendue : alerte « erreur serveur » sans les paramètres de requête, réponse 500 inchangée', () => {
    const { filter, alerts, host, httpAdapter } = setup();
    filter.catch(new Error('boom'), host);
    expect(alerts.emit).toHaveBeenCalledWith({ kind: 'server_error', method: 'POST', path: '/api/invoices', message: 'boom' });
    expect(httpAdapter.reply).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ statusCode: 500 }), 500);
  });

  it('erreur 400 (saisie refusée) : pas d’alerte', () => {
    const { filter, alerts, host } = setup();
    filter.catch(new BadRequestException('non'), host);
    expect(alerts.emit).not.toHaveBeenCalled();
  });
});
