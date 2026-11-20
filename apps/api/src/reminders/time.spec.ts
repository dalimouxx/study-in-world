import { dayRange, localDateKey, localHour } from './time';

describe('fuseau horaire des relances', () => {
  it('dayRange : « demain » à Tunis (UTC+1) vu à 23:30 locale', () => {
    const now = new Date('2026-11-16T22:30:00Z'); // 23:30 à Tunis, le 16
    expect(dayRange(now, 'Africa/Tunis', 1)).toEqual({ start: new Date('2026-11-16T23:00:00Z'), end: new Date('2026-11-17T23:00:00Z') });
  });

  it('dayRange : « aujourd’hui » à Tunis vu à 00:30 locale', () => {
    const now = new Date('2026-11-16T23:30:00Z'); // 00:30 à Tunis, le 17
    expect(dayRange(now, 'Africa/Tunis', 0)).toEqual({ start: new Date('2026-11-16T23:00:00Z'), end: new Date('2026-11-17T23:00:00Z') });
  });

  it('dayRange : fuseau avec changement d’heure (Europe/Paris, jour de 23 h)', () => {
    const now = new Date('2026-03-28T12:00:00Z');
    const { start, end } = dayRange(now, 'Europe/Paris', 1); // 29 mars : passage à l'heure d'été
    expect(start).toEqual(new Date('2026-03-28T23:00:00Z'));
    expect(end).toEqual(new Date('2026-03-29T22:00:00Z'));
  });

  it('localHour et localDateKey', () => {
    expect(localHour(new Date('2026-11-16T06:10:00Z'), 'Africa/Tunis')).toBe(7);
    expect(localDateKey(new Date('2026-11-16T23:30:00Z'), 'Africa/Tunis')).toBe('2026-11-17');
  });
});
