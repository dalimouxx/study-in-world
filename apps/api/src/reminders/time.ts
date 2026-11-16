// Calculs de dates dans le fuseau de l'agence (AgencySettings.timezone), sans dépendance externe :
// « aujourd'hui », « demain » et l'heure de la tournée du matin sont toujours ceux de l'agence, pas du serveur.

function parts(date: Date, timeZone: string) {
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
  });
  const p = Object.fromEntries(fmt.formatToParts(date).map((x) => [x.type, x.value]));
  return { y: +p.year, m: +p.month, d: +p.day, h: +p.hour, min: +p.minute, s: +p.second };
}

/** Décalage (ms) entre l'heure locale du fuseau et UTC à cet instant. */
function offsetMs(date: Date, timeZone: string): number {
  const p = parts(date, timeZone);
  return Date.UTC(p.y, p.m - 1, p.d, p.h, p.min, p.s) - Math.floor(date.getTime() / 1000) * 1000;
}

/** Instant UTC correspondant à minuit local du jour (y, m, d) dans le fuseau. */
function localMidnight(y: number, m: number, d: number, timeZone: string): Date {
  const guess = Date.UTC(y, m - 1, d);
  // Deux passes suffisent, y compris autour d'un changement d'heure.
  let t = guess - offsetMs(new Date(guess), timeZone);
  t = guess - offsetMs(new Date(t), timeZone);
  return new Date(t);
}

/** Journée locale « aujourd'hui + offsetDays » : début inclus, fin exclue, en instants UTC. */
export function dayRange(now: Date, timeZone: string, offsetDays: number): { start: Date; end: Date } {
  const p = parts(now, timeZone);
  const day = new Date(Date.UTC(p.y, p.m - 1, p.d + offsetDays));
  const next = new Date(Date.UTC(p.y, p.m - 1, p.d + offsetDays + 1));
  return {
    start: localMidnight(day.getUTCFullYear(), day.getUTCMonth() + 1, day.getUTCDate(), timeZone),
    end: localMidnight(next.getUTCFullYear(), next.getUTCMonth() + 1, next.getUTCDate(), timeZone),
  };
}

export function localHour(now: Date, timeZone: string): number {
  return parts(now, timeZone).h;
}

/** Date locale au format YYYY-MM-DD (sert aussi de partie de clé « une fois par jour »). */
export function localDateKey(now: Date, timeZone: string): string {
  const p = parts(now, timeZone);
  return `${p.y}-${String(p.m).padStart(2, '0')}-${String(p.d).padStart(2, '0')}`;
}

export const DAY_MS = 86_400_000;
