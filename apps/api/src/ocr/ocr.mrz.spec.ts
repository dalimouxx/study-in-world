import { mrzCheckDigit, parseTd3 } from './ocr.service';

/**
 * Exemple officiel ICAO Doc 9303 Partie 4, Annexe B — un passeport fictif utilisé dans les spécifications
 * publiques pour illustrer le calcul de la somme de contrôle. Sert de vecteur de test connu et vérifiable.
 */
const LINE1 = 'P<UTOERIKSSON<<ANNA<MARIA<<<<<<<<<<<<<<<<<<<';
const LINE2 = 'L898902C36UTO7408122F1204159ZE184226B<<<<<10';

describe('mrzCheckDigit — norme ICAO 9303', () => {
  it('calcule la somme de contrôle attendue pour le numéro de document de l’exemple officiel', () => {
    expect(mrzCheckDigit('L898902C3')).toBe(6);
  });

  it('calcule la somme de contrôle attendue pour une date de naissance', () => {
    expect(mrzCheckDigit('740812')).toBe(2);
  });

  it('traite « < » comme la valeur 0', () => {
    expect(mrzCheckDigit('<<<')).toBe(0);
  });
});

describe('parseTd3 — décodage de la zone MRZ d’un passeport', () => {
  it('extrait correctement le nom, le numéro et les dates depuis l’exemple officiel ICAO', () => {
    const result = parseTd3(LINE1, LINE2);
    expect(result.lastName).toBe('ERIKSSON');
    expect(result.firstName).toBe('ANNA MARIA');
    expect(result.documentNumber).toBe('L898902C3');
    expect(result.documentNumberValid).toBe(true);
    expect(result.birthDateRaw).toBe('740812');
    expect(result.birthDateValid).toBe(true);
    expect(result.expirationDateRaw).toBe('120415');
    expect(result.expirationDateValid).toBe(true);
    expect(result.sex).toBe('F');
    expect(result.compositeValid).toBe(true);
  });

  it('signale une somme de contrôle invalide quand un chiffre de la ligne a été mal lu par l’OCR', () => {
    const corrupted = LINE2.slice(0, 9) + '9' + LINE2.slice(10); // chiffre de contrôle du document faussé
    const result = parseTd3(LINE1, corrupted);
    expect(result.documentNumberValid).toBe(false);
  });
});
