# Sauvegarde hors du VPS et double authentification — plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal :** sauvegarde nocturne chiffrée (base + documents + `.env`) vers Backblaze B2 avec restauration testée, et double authentification TOTP pour les employés (obligatoire pour les administrateurs).

**Architecture :** scripts bash dans `deploy/` (`backup.sh`, `restore.sh`) avec `gpg` + `rclone` ; module `apps/api/src/auth/two-factor/` (secret chiffré, codes de secours hachés, jeton d'étape, garde global) ; écrans web dans `features/auth` et `features/account`.

**Tech Stack :** bash, gpg (AES-256 symétrique), rclone (backend b2), Docker Compose ; NestJS, Prisma (migration), otplib 12.0.1, qrcode 1.5.4, argon2 ; Next.js, next-intl.

**Spec :** `docs/superpowers/specs/2026-11-20-sauvegarde-et-double-authentification-design.md`

## Global Constraints
- Aucun secret affiché par les scripts ni envoyé sur Telegram ; `.env` jamais commité.
- Archive : `siw-AAAA-MM-JJ.tar.gz.gpg` ; B2 : 30 jours par règle de cycle de vie (la clé du VPS ne supprime pas) ; local : 7 jours.
- TOTP : 6 chiffres, période 30 s, tolérance ±1 ; 10 codes de secours à usage unique ; jeton d'étape 5 minutes.
- Obligatoire : rôles `SUPER_ADMIN`, `ADMIN`, et `isPlatformAdmin` ; facultatif pour les autres employés.
- Les erreurs de code comptent dans le verrouillage existant (`LOGIN_MAX_ATTEMPTS`, `LOGIN_LOCK_MINUTES`).
- Textes FR et AR (clés fr = ar).

## Review Focus
1. Code TOTP rejoué dans la même période après une connexion réussie → refusé (anti-rejeu, test Task 2).
2. Jeton d'étape réutilisé ou expiré → refusé (Task 2).
3. Administrateur tentant de désactiver sa double authentification → refusé (Task 2).
4. `restore.sh` sans `--production` ne touche jamais la base ni les documents de production (Task 1).
5. Sauvegarde dont l'envoi échoue → code de sortie non nul, alerte Telegram « Échec », archive locale gardée (Task 1).

---

### Task 1 : Sauvegarde et restauration
**Files :** Modify `deploy/backup.sh`, `deploy/.env.production.example`, `deploy/README.md` ; Create `deploy/restore.sh`.
- `backup.sh` : `pg_dump -Fc` via `docker compose exec -T db`, copie du volume documents via `docker run --rm -v studyinworld_documents:/data:ro`, copie de `.env` → `tar.gz` → `gpg --batch --symmetric --cipher-algo AES256 --passphrase-fd` (phrase lue dans `.env`, jamais en argument) → `rclone copy` vers `:b2,account=…,key=…:<bucket>/studyinworld/` (remote en ligne, rien d'écrit sur disque) ; variable `BACKUP_REMOTE` pour les tests ; Telegram réussite (taille) ou échec (étape) ; purge locale > 7 jours.
- `restore.sh AAAA-MM-JJ [--production]` : récupère (local d'abord, sinon B2), déchiffre, restaure : par défaut dans une base `siw_restore_check` et `/var/tmp/studyinworld-restore/documents`, puis affiche nombres de candidats, d'utilisateurs, de fichiers ; avec `--production`, confirmation tapée `RESTAURER`, arrêt de l'API, `pg_restore --clean`, remplacement des documents, relance.
- [ ] Test local (Docker, Postgres du miroir, faux `rclone` qui copie dans un dossier) : sauvegarde → archive illisible sans phrase → restauration de contrôle → mêmes nombres ; échec d'envoi → sortie ≠ 0 et message « Échec ».
- [ ] Commit `feat(deploy): sauvegarde chiffrée vers Backblaze B2 et restauration testée`.

### Task 2 : Double authentification — API
**Files :** `prisma/schema.prisma` + migration `1_two_factor` ; Create `src/auth/two-factor/{totp-crypto.ts,two-factor.service.ts,two-factor.controller.ts,two-factor.guard.ts,dto.ts}` + specs ; Modify `auth.service.ts` (login, refresh, issueTokens), `auth.module.ts`, `app.module.ts`, `config/env.ts` (`TOTP_ENCRYPTION_KEY`, 32+ car., facultatif → sinon dérivé de `JWT_SECRET` par HKDF), `common/auth-user.ts` (`mustSetupTwoFactor`), employés (reset) ; Create `scripts/disable-2fa.ts`.
- `User` : `totpSecret String?`, `totpPendingSecret String?`, `totpEnabledAt DateTime?`, `totpRecoveryCodes String[]`, `totpLastUsedStep Int?`.
- `POST /auth/login` → si 2FA activée : `{ twoFactorRequired: true, twoFactorToken }` (JWT `typ: '2fa'`, 5 min, `jti` à usage unique) ; `POST /auth/2fa/verify { twoFactorToken, code }` → session (même réponse que login).
- `POST /auth/2fa/setup` → `{ otpauthUrl, qrDataUrl }` ; `POST /auth/2fa/enable { code }` → `{ recoveryCodes: string[10] }` ; `POST /auth/2fa/disable { password, code }` (refus `TWO_FACTOR_REQUIRED` si rôle obligatoire) ; `POST /employees/:id/2fa/reset` (Super Admin, audit).
- `AuthUser.mustSetupTwoFactor` = rôle obligatoire && non activée, calculé à login/refresh/me ; `TwoFactorSetupGuard` (APP_GUARD) : 403 `TWO_FACTOR_SETUP_REQUIRED` sauf routes `auth/me`, `auth/logout`, `auth/refresh`, `auth/2fa/setup`, `auth/2fa/enable`.
- [ ] Tests : code valide/invalide/période voisine ; anti-rejeu ; code de secours une seule fois ; jeton d'étape expiré/réutilisé ; erreurs → verrouillage ; obligation ADMIN/SUPER_ADMIN/isPlatformAdmin ; garde ; désactivation refusée pour admin ; reset ; secret chiffré en base.
- [ ] Commit `feat(api): double authentification par application (codes de secours, obligatoire pour les administrateurs)`.

### Task 3 : Double authentification — web
**Files :** `features/auth/login-form.tsx` (étape code), Create `features/account/two-factor-section.tsx`, page `app/[locale]/(admin)/account/two-factor-setup` (ou section forcée), `components/auth-guard.tsx` (redirection si `mustSetupTwoFactor`), fiche employé (bouton reset), `lib/types.ts`, `messages/{fr,ar}.json`.
- [ ] Gate web (tsc, unit, i18n, build) ; parcours réel au navigateur : activer (QR + code otplib), se déconnecter, se reconnecter avec code, code de secours ; admin forcé à la mise en place ; captures FR/AR 1280/390.
- [ ] Commit `feat(web): double authentification (connexion, Mon compte, mise en place obligatoire)`.

### Task 4 : Vérification finale
- [ ] Suites complètes, `visual-check` complet, relecture indépendante, push ; guide VPS (B2 : compte, compartiment privé, règle 30 jours, clé sans suppression ; `TOTP_ENCRYPTION_KEY` ; commande de secours `disable-2fa`).
