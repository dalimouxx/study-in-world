import { DEFAULT_TEMPLATES } from './defaults';
import { formatDateFor, renderTemplate, TEMPLATE_VARIABLES } from './render';

describe('renderTemplate', () => {
  it('remplace les variables', () => {
    expect(renderTemplate('Bonjour {prenom}, RDV le {date} à {heure}', { prenom: 'Yasmine', date: '17/11/2026', heure: '10:00' }))
      .toBe('Bonjour Yasmine, RDV le 17/11/2026 à 10:00');
  });

  it('variable inconnue retirée, jamais affichée', () => {
    const out = renderTemplate('Bonjour {prénom} !', {});
    expect(out).toBe('Bonjour !');
    expect(out).not.toContain('{');
  });

  it('variable vide retirée avec son séparateur', () => {
    expect(renderTemplate('Lieu : {lieu}', { lieu: '' })).toBe('Lieu');
    expect(renderTemplate('Rendez-vous demain · {lieu}', {})).toBe('Rendez-vous demain');
  });

  it('garde les retours à la ligne et le texte arabe', () => {
    expect(renderTemplate('مرحبًا {prenom}\nشكرًا', { prenom: 'ياسمين' })).toBe('مرحبًا ياسمين\nشكرًا');
  });
});

describe('formatDateFor', () => {
  it('formate dans le fuseau de l’agence', () => {
    const { date, heure } = formatDateFor('fr', new Date('2026-11-17T09:00:00Z'), 'Africa/Tunis');
    expect(date).toBe('17/11/2026');
    expect(heure).toBe('10:00');
  });
});

describe('DEFAULT_TEMPLATES', () => {
  const system = ['APPOINTMENT_TOMORROW', 'VISA_APPOINTMENT_TOMORROW', 'PROSPECT_FOLLOW_UP', 'INVOICE_OVERDUE', 'DOCUMENT_REJECTED'];
  it.each(system)('%s existe en WhatsApp et en e-mail', (key) => {
    expect(DEFAULT_TEMPLATES.filter((t) => t.key === key && t.isSystem).map((t) => t.channel).sort()).toEqual(['EMAIL', 'WHATSAPP']);
  });

  it('le récapitulatif du matin existe en e-mail', () => {
    expect(DEFAULT_TEMPLATES.some((t) => t.key === 'DAILY_DIGEST' && t.channel === 'EMAIL')).toBe(true);
  });

  it('chaque modèle n’utilise que des variables connues, en FR et en AR', () => {
    for (const t of DEFAULT_TEMPLATES) {
      for (const text of [t.bodyFr, t.bodyAr, t.subjectFr ?? '', t.subjectAr ?? '']) {
        const used = [...text.matchAll(/\{([^}]+)\}/g)].map((m) => m[1]);
        expect(used.filter((v) => !(TEMPLATE_VARIABLES as readonly string[]).includes(v))).toEqual([]);
      }
    }
  });
});
