// Champs « date et heure » (datetime-local) : la valeur saisie est l'heure locale de l'employé. On l'envoie à
// l'API en instant UTC explicite ; sinon le serveur l'interprète dans son propre fuseau (souvent UTC) et
// l'heure enregistrée — puis affichée dans les rappels envoyés aux clients — est décalée. Sans import : testé par `node --test`.

export function localInputToIso(value: string | null | undefined): string | undefined {
  if (!value) return undefined;
  const d = new Date(value); // sans fuseau : interprété en heure locale du navigateur
  return Number.isNaN(d.getTime()) ? undefined : d.toISOString();
}

export function isoToLocalInput(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
