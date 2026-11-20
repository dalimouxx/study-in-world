// Lien WhatsApp « en un clic » des relances et des messages tout prêts. Sans import : testé par `node --test`.

/** Lien wa.me avec le texte pré-rempli ; `null` si le numéro est vide ou trop court pour être exploitable. */
export function buildWhatsappUrl(phone: string | null | undefined, text: string): string | null {
  const digits = (phone ?? '').replace(/[^0-9]/g, '');
  if (digits.length < 8) return null;
  return `https://wa.me/${digits}?text=${encodeURIComponent(text)}`;
}
