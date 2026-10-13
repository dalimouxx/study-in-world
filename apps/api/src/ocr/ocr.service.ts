import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { createWorker, type Worker } from 'tesseract.js';
import * as path from 'path';

export interface OcrPassportField {
  value: string | null;
  valid: boolean;
}

export interface OcrPassportResult {
  success: boolean;
  warning: string | null;
  documentNumber: OcrPassportField | null;
  lastName: OcrPassportField | null;
  firstName: OcrPassportField | null;
  nationality: OcrPassportField | null;
  birthDate: OcrPassportField | null; // ISO (YYYY-MM-DD)
  expirationDate: OcrPassportField | null; // ISO (YYYY-MM-DD)
  sex: OcrPassportField | null;
}

const MRZ_LINE = /^[A-Z0-9<]{30,44}$/;
const TD3_LENGTH = 44;
const CHECK_WEIGHTS = [7, 3, 1];

/**
 * OCR gratuit et hors-ligne (Tesseract.js + zone MRZ du passeport, format TD3) : section 20 du cahier des
 * charges, mais volontairement limité au strict nécessaire — jamais de saisie automatique, toujours une
 * suggestion que l'employé doit valider. La précision dépend beaucoup de la netteté et du cadrage de la
 * photo ; le champ `valid` (somme de contrôle MRZ officielle, norme ICAO 9303) indique si une valeur est
 * fiable ou juste une estimation.
 *
 * L'algorithme MRZ est réimplémenté ici plutôt que d'utiliser le paquet npm `mrz` : celui-ci n'est distribué
 * qu'en ESM pur, incompatible avec la configuration CommonJS de ce projet (et de Jest) — l'algorithme officiel
 * étant court et entièrement documenté (norme ICAO), l'écrire directement évite ce conflit d'outillage sans
 * complexité ajoutée.
 */
@Injectable()
export class OcrService implements OnModuleDestroy {
  private worker: Promise<Worker> | null = null;

  private getWorker(): Promise<Worker> {
    if (!this.worker) {
      this.worker = createWorker('eng', 1, {
        langPath: path.join(__dirname, '..', '..', 'tessdata'),
        gzip: true,
        cachePath: '/tmp/tesseract-cache',
      });
    }
    // Après l'assignation ci-dessus, this.worker n'est plus null — certaines versions de TypeScript ne
    // rétablissent pas ce type automatiquement pour un champ de classe (contrairement à une variable locale),
    // d'où cette assertion explicite plutôt que de dépendre d'un comportement qui varie selon la version.
    return this.worker as Promise<Worker>;
  }

  async onModuleDestroy(): Promise<void> {
    if (this.worker) await (await this.worker).terminate();
  }

  async extractPassport(imageBuffer: Buffer): Promise<OcrPassportResult> {
    const worker = await this.getWorker();
    const { data } = await worker.recognize(imageBuffer);

    const candidateLines = data.text
      .split('\n')
      .map((l: string) => l.trim().toUpperCase().replace(/\s+/g, ''))
      .filter((l: string) => MRZ_LINE.test(l));

    if (candidateLines.length < 2) {
      return this.empty('Aucune zone lisible par machine (MRZ) détectée — vérifiez que la photo cadre bien le bas du passeport, net et sans reflet.');
    }

    // TD3 (passeport) : les deux dernières lignes candidates sont retenues — la MRZ est toujours en bas de page.
    const [line1, line2] = candidateLines.slice(-2).map((l: string) => l.padEnd(TD3_LENGTH, '<').slice(0, TD3_LENGTH));

    const parsed = parseTd3(line1, line2);
    return {
      success: true,
      warning: parsed.compositeValid ? null : 'Certaines sommes de contrôle MRZ ne correspondent pas — vérifiez chaque champ avant de l’appliquer au dossier.',
      documentNumber: { value: parsed.documentNumber || null, valid: parsed.documentNumberValid },
      lastName: { value: parsed.lastName || null, valid: true },
      firstName: { value: parsed.firstName || null, valid: true },
      nationality: { value: parsed.nationality.replace(/</g, '') || null, valid: true },
      birthDate: { value: toIsoDate(parsed.birthDateRaw, true), valid: parsed.birthDateValid },
      expirationDate: { value: toIsoDate(parsed.expirationDateRaw, false), valid: parsed.expirationDateValid },
      sex: { value: parsed.sex === 'M' || parsed.sex === 'F' ? parsed.sex : null, valid: true },
    };
  }

  private empty(warning: string): OcrPassportResult {
    return { success: false, warning, documentNumber: null, lastName: null, firstName: null, nationality: null, birthDate: null, expirationDate: null, sex: null };
  }
}

function charValue(c: string): number {
  if (c === '<') return 0;
  if (c >= '0' && c <= '9') return c.charCodeAt(0) - 48;
  if (c >= 'A' && c <= 'Z') return c.charCodeAt(0) - 65 + 10;
  return 0;
}

/** Norme ICAO 9303 : poids 7-3-1 répétés, somme modulo 10. */
export function mrzCheckDigit(s: string): number {
  let sum = 0;
  for (let i = 0; i < s.length; i++) sum += charValue(s[i]) * CHECK_WEIGHTS[i % 3];
  return sum % 10;
}

function checkDigitMatches(field: string, digit: string): boolean {
  return /^\d$/.test(digit) && mrzCheckDigit(field) === Number(digit);
}

/** SURNAME<<GIVEN<NAMES : le séparateur double `<<` sépare toujours le nom des prénoms. */
function parseName(field: string): { lastName: string; firstName: string } {
  const [last, ...rest] = field.split('<<');
  return { lastName: (last ?? '').replace(/</g, ' ').trim(), firstName: rest.join(' ').replace(/</g, ' ').trim() };
}

/** Décodage TD3 (passeport, 2 lignes de 44 caractères) — norme ICAO 9303 partie 4. */
export function parseTd3(line1: string, line2: string) {
  const { lastName, firstName } = parseName(line1.slice(5, 44));

  const documentNumberRaw = line2.slice(0, 9);
  const documentNumberCheck = line2[9];
  const nationality = line2.slice(10, 13);
  const birthDateRaw = line2.slice(13, 19);
  const birthDateCheck = line2[19];
  const sex = line2[20];
  const expirationDateRaw = line2.slice(21, 27);
  const expirationDateCheck = line2[27];
  const personalNumberRaw = line2.slice(28, 42);
  const personalNumberCheck = line2[42];
  const compositeCheck = line2[43];
  const compositeInput = documentNumberRaw + documentNumberCheck + birthDateRaw + birthDateCheck + expirationDateRaw + expirationDateCheck + personalNumberRaw + personalNumberCheck;

  return {
    lastName,
    firstName,
    documentNumber: documentNumberRaw.replace(/</g, ''),
    documentNumberValid: checkDigitMatches(documentNumberRaw, documentNumberCheck),
    nationality,
    birthDateRaw,
    birthDateValid: checkDigitMatches(birthDateRaw, birthDateCheck),
    sex,
    expirationDateRaw,
    expirationDateValid: checkDigitMatches(expirationDateRaw, expirationDateCheck),
    compositeValid: checkDigitMatches(compositeInput, compositeCheck),
  };
}

/** MRZ stocke les dates en YYMMDD ; une naissance ne peut jamais être dans le futur, une expiration presque toujours proche. */
function toIsoDate(yymmdd: string, isBirthDate: boolean): string | null {
  if (!/^\d{6}$/.test(yymmdd)) return null;
  const yy = parseInt(yymmdd.slice(0, 2), 10);
  const mm = yymmdd.slice(2, 4);
  const dd = yymmdd.slice(4, 6);
  const currentYy = new Date().getFullYear() % 100;
  const century = isBirthDate ? (yy > currentYy ? 1900 : 2000) : 2000;
  return `${century + yy}-${mm}-${dd}`;
}
