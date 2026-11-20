// Texte des alertes Telegram (HTML de Telegram). Court, en français, avec un lien vers la fiche.
// Confidentialité : type d'événement, nom, numéro de document et lien seulement — jamais de pièce, de numéro de
// passeport, de montant ni de contenu de message (le groupe Telegram est hors de la plateforme).

export type AlertEvent =
  | { kind: 'lead'; name: string }
  | { kind: 'portal_document'; candidateId: string; name: string; document: string }
  | { kind: 'portal_message'; candidateId: string; name: string }
  | { kind: 'contract_signed_online'; candidateId: string; name: string; number: string }
  | { kind: 'partner_comment'; candidateId: string; name: string; partner: string }
  | { kind: 'candidate_created'; candidateId: string; name: string; by: string }
  | { kind: 'invoice'; candidateId: string; name: string; invoiceNumber: string; by: string }
  | { kind: 'payment'; candidateId: string; name: string; invoiceNumber: string; by: string }
  | { kind: 'server_error'; method: string; path: string; message: string };

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const cut = (s: string, n: number) => (s.length > n ? `${s.slice(0, n)}…` : s);

export function alertText(e: AlertEvent, baseUrl: string): string {
  const candidate = (id: string) => `${baseUrl}/fr/candidates/${id}`;
  const lines = (icon: string, title: string, detail: string, link?: string) =>
    [`${icon} <b>${title}</b>`, detail, link ? `<a href="${link}">Ouvrir dans Study in World</a>` : '']
      .filter(Boolean)
      .join('\n');
  switch (e.kind) {
    case 'lead':
      return lines('🆕', 'Nouveau prospect', `${esc(e.name)} — formulaire du site`, `${baseUrl}/fr/prospects`);
    case 'portal_document':
      return lines('📄', 'Document déposé', `${esc(e.name)} — ${esc(e.document)}`, candidate(e.candidateId));
    case 'portal_message':
      return lines('💬', 'Nouveau message d’un candidat', esc(e.name), candidate(e.candidateId));
    case 'contract_signed_online':
      return lines('✍️', 'Contrat signé en ligne', `${esc(e.name)} — ${esc(e.number)}`, candidate(e.candidateId));
    case 'partner_comment':
      return lines('🤝', 'Commentaire d’un partenaire', `${esc(e.partner)} sur le dossier de ${esc(e.name)}`, candidate(e.candidateId));
    case 'candidate_created':
      return lines('👤', 'Nouveau candidat', `${esc(e.name)} — créé par ${esc(e.by)}`, candidate(e.candidateId));
    case 'invoice':
      return lines('🧾', 'Facture émise', `${esc(e.invoiceNumber)} — ${esc(e.name)} (par ${esc(e.by)})`, candidate(e.candidateId));
    case 'payment':
      return lines('💰', 'Paiement enregistré', `Facture ${esc(e.invoiceNumber)} — ${esc(e.name)} (par ${esc(e.by)})`, candidate(e.candidateId));
    case 'server_error':
      return lines('🚨', 'Erreur serveur', `<code>${esc(e.method)} ${esc(cut(e.path, 120))}</code>\n${esc(cut(e.message, 200))}`);
  }
}
