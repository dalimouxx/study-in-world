import { z } from 'zod';

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().default(4000),
  DATABASE_URL: z.string().min(1),
  JWT_SECRET: z.string().min(32, 'JWT_SECRET doit contenir au moins 32 caractères'),
  JWT_ACCESS_TTL: z.string().default('15m'),
  REFRESH_TTL_DAYS: z.coerce.number().default(30),
  // Portail candidat : secret distinct par défense en profondeur (sinon retombe sur JWT_SECRET, aucune config obligatoire de plus).
  CANDIDATE_JWT_SECRET: z.string().min(32).optional(),
  CANDIDATE_JWT_ACCESS_TTL: z.string().default('30m'),
  CANDIDATE_REFRESH_TTL_DAYS: z.coerce.number().default(90),
  // Portail partenaire : même logique — secret distinct optionnel, sinon retombe sur JWT_SECRET.
  PARTNER_JWT_SECRET: z.string().min(32).optional(),
  PARTNER_JWT_ACCESS_TTL: z.string().default('30m'),
  PARTNER_REFRESH_TTL_DAYS: z.coerce.number().default(90),
  // Assistant IA (Phase 10) : entièrement optionnel — sans clé, l'assistant répond simplement qu'il n'est
  // pas configuré, exactement comme le SMTP absent ne bloque jamais l'envoi de mail (il le journalise).
  ANTHROPIC_API_KEY: z.string().optional(),
  ANTHROPIC_MODEL: z.string().default('claude-sonnet-5'),
  APP_URL: z.string().url().default('http://localhost:4000'),
  FRONTEND_URL: z.string().url().default('http://localhost:3000'),
  DEFAULT_ORG_SLUG: z.string().default('study-in-world'),
  LOGIN_MAX_ATTEMPTS: z.coerce.number().default(5),
  LOGIN_LOCK_MINUTES: z.coerce.number().default(15),
  SWAGGER_ENABLED: z
    .enum(['true', 'false'])
    .optional()
    .transform((v) => v === 'true'),
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().default(587),
  SMTP_USER: z.string().optional(),
  SMTP_PASSWORD: z.string().optional(),
  MAIL_FROM: z.string().default('Study in World <contact@studyinworld.net>'),
});

export type Env = z.infer<typeof schema>;

export function validateEnv(raw: Record<string, unknown>): Env {
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `- ${i.path.join('.')}: ${i.message}`).join('\n');
    throw new Error(`Configuration invalide :\n${issues}`);
  }
  return parsed.data;
}
