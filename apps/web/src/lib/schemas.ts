import { z } from 'zod';

type T = (key: string) => string;

export const PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{10,128}$/;

export const passwordSchema = (t: T) => z.string().regex(PASSWORD_REGEX, t('passwordRule'));

/** Les champs optionnels de formulaire arrivent en chaîne vide : on les envoie sous forme `''` (l'API efface) ou on les omet. */
export const emptyToUndefined = <V extends Record<string, unknown>>(values: V) =>
  Object.fromEntries(Object.entries(values).filter(([, v]) => v !== '')) as Partial<V>;
