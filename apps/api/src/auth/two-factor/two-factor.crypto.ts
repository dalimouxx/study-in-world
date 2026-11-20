// Outils purs de la double authentification : chiffrement du secret, codes de secours, rôles concernés.
import { createCipheriv, createDecipheriv, createHash, hkdfSync, randomBytes, randomInt } from 'crypto';
import { SUPER_ADMIN_ROLE } from '../../rbac/permissions';

/** Clé de 32 octets dérivée d'un secret de configuration, une par usage (« purpose ») : jamais la même clé deux fois. */
export function deriveKey(material: string, purpose: string): Buffer {
  return Buffer.from(hkdfSync('sha256', material, 'study-in-world', purpose, 32));
}

/** Clé de chiffrement des secrets TOTP : TOTP_ENCRYPTION_KEY si définie, sinon dérivée de JWT_SECRET. */
export function totpKey(totpEncryptionKey: string | undefined, jwtSecret: string): Buffer {
  return totpEncryptionKey ? createHash('sha256').update(totpEncryptionKey).digest() : deriveKey(jwtSecret, 'totp-secret');
}

/** AES-256-GCM : « v1.iv.tag.texte » en base64url. Toute modification du texte chiffré est détectée au déchiffrement. */
export function encryptSecret(plain: string, key: Buffer): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const data = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  return ['v1', iv, cipher.getAuthTag(), data].map((p) => (typeof p === 'string' ? p : p.toString('base64url'))).join('.');
}

export function decryptSecret(encoded: string, key: Buffer): string {
  const [version, iv, tag, data] = encoded.split('.');
  if (version !== 'v1' || !iv || !tag || !data) throw new Error('Secret TOTP illisible');
  const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(iv, 'base64url'));
  decipher.setAuthTag(Buffer.from(tag, 'base64url'));
  return Buffer.concat([decipher.update(Buffer.from(data, 'base64url')), decipher.final()]).toString('utf8');
}

// Sans caractères faciles à confondre (0/o, 1/l/i).
const ALPHABET = 'abcdefghjkmnpqrstuvwxyz23456789';

/** 10 codes de secours « xxxx-xxxx », à usage unique. */
export function generateRecoveryCodes(count = 10): string[] {
  const part = () => Array.from({ length: 4 }, () => ALPHABET[randomInt(ALPHABET.length)]).join('');
  return Array.from({ length: count }, () => `${part()}-${part()}`);
}

/** Forme comparable d'un code de secours saisi (majuscules, espaces et tiret tolérés). */
export const normalizeRecoveryCode = (code: string) => {
  const c = code.toLowerCase().replace(/[\s-]/g, '');
  return c.length === 8 ? `${c.slice(0, 4)}-${c.slice(4)}` : c;
};

/** Double authentification obligatoire : Super Admin, administrateurs d'agence et administrateurs de la plateforme. */
export function requiresTwoFactor(roleCode: string, isPlatformAdmin: boolean): boolean {
  return isPlatformAdmin || roleCode === SUPER_ADMIN_ROLE || roleCode === 'ADMIN';
}
