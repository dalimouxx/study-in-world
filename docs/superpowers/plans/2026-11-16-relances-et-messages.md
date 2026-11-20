# Relances automatiques et messages tout prêts — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** La plateforme repère chaque matin les relances (rendez-vous, prospects, factures, documents rejetés), envoie les e-mails automatiques sans doublon, et chaque conseiller traite le reste en un clic WhatsApp avec des messages modifiables en FR/AR.

**Architecture:** Un module NestJS `reminders` détecte les situations (une seule fonction de détection, utilisée par la tournée du matin et par la page « Relances du jour »). Un journal `ReminderLog`, avec une clé unique, empêche les doublons. Un module `message-templates` stocke et remplit les modèles. La tournée est déclenchée par `@nestjs/schedule` (toutes les heures, agences à 07:xx locale) et par `POST /api/jobs/daily-reminders` protégé par secret. Côté web : page `/reminders`, page `/settings/messages`, bouton « Envoyer un message » et champ « langue préférée ».

**Tech Stack:** NestJS 11, Prisma/PostgreSQL, Jest (API) ; Next.js 15, next-intl, TanStack Query, `node --test`, Playwright (`scripts/visual-check.mjs`) (web).

**Spec:** `docs/superpowers/specs/2026-11-16-relances-et-messages-design.md` (§4–§9 et §13 font foi).

## Global Constraints

- Tout est filtré par `organizationId` (aucune donnée inter-agences).
- Dates « aujourd'hui » et « demain » et heure de tournée dans le fuseau `AgencySettings.timezone` (défaut `Africa/Tunis`). Tournée à 07:00–07:59 locale.
- Facture : au plus 3 e-mails, au moins 7 jours entre deux. Document rejeté : fenêtre de 7 jours depuis `reviewedAt`.
- Clé verrouillée seulement par un journal `SENT`. `SKIPPED` et `FAILED` ne consomment pas la relance.
- Exclusions : candidat `ARCHIVED` ou `deletedAt`, prospect `deletedAt`, `CONVERTED` ou `LOST`, rendez-vous non `SCHEDULED`, visa `APPROVED`/`REFUSED`.
- Aucune `{variable}` ne doit rester dans un message envoyé ou ouvert.
- Pas de nouvelle permission. Page Relances : `candidate.view` OU `prospect.view`. Modèles : lecture `settings.view`, écriture `settings.manage`.
- Variables d'environnement nouvelles : `JOBS_SECRET` (optionnelle ; absente → route 404), `REMINDERS_CRON_ENABLED` (défaut `true`).
- Base : `prisma db push` (pas de migrations dans le dépôt).
- UI : style Bento Pop existant, tout texte visible en FR **et** AR (`check-i18n` doit passer), propriétés logiques RTL.
- Gate de chaque tâche : `cd apps/api && npx jest && npx tsc --noEmit` ; `cd apps/web && npm run typecheck && node scripts/check-i18n.mjs && npm run test:unit`.

## Review Focus

1. **Minuit et fuseau** : un rendez-vous à 00:30 heure de Tunis le lendemain est « demain », un rendez-vous à 23:30 le jour même ne l'est pas, alors que leur date UTC diffère. Test `dayRange` (Task 2) et `détecte un rendez-vous à 00:30 locale` (Task 4).
2. **Deux tournées simultanées** (cron + route extérieure en même temps) : un seul e-mail. Test `deux tournées concurrentes n'envoient qu'une fois` (Task 5), avec la contrainte d'unicité qui lève P2002 sur la seconde insertion.
3. **Candidat sans e-mail puis e-mail ajouté** : l'e-mail part à la tournée suivante si la situation est encore valable. Test `un SKIPPED ne verrouille pas la clé` (Task 5).
4. **Texte du modèle modifié par l'agence avec une variable mal tapée** (`{prénom}` avec accent, `{inconnue}`) : retirée proprement, jamais affichée. Test `variable inconnue retirée` (Task 2).
5. **Conseiller sans e-mail ni langue définie, ou désactivé** : récapitulatif seulement aux employés actifs et non supprimés, dans leur `locale`. Test `récapitulatif ignore les employés inactifs` (Task 5).

---

## File Structure

| Fichier | Responsabilité |
|---|---|
| `apps/api/prisma/schema.prisma` | `ReminderLog`, `MessageTemplate`, enums, `preferredLanguage`, `reviewedAt`, `NotificationType` + 2 valeurs |
| `apps/api/src/reminders/time.ts` | fonctions pures de fuseau : `dayRange`, `localHour`, `localDateKey` |
| `apps/api/src/message-templates/render.ts` | `renderTemplate` pur |
| `apps/api/src/message-templates/defaults.ts` | modèles par défaut FR/AR |
| `apps/api/src/message-templates/message-templates.{service,controller,module}.ts` | CRUD + `ensureDefaults` + `render` contextuel |
| `apps/api/src/reminders/reminders.detect.ts` | `detectReminders(prisma, orgId, now, tz)` |
| `apps/api/src/reminders/reminders.service.ts` | tournée, journal, liste du jour, « fait » |
| `apps/api/src/reminders/reminders.controller.ts` | `GET /reminders/today`, `POST /reminders/done` |
| `apps/api/src/reminders/jobs.controller.ts` | `POST /jobs/daily-reminders` |
| `apps/api/src/reminders/reminders.module.ts` | module + cron |
| `apps/web/src/features/reminders/*` | page Relances, widget, dialogue « prochaine relance » |
| `apps/web/src/features/message-templates/*` | page des modèles, dialogue « Envoyer un message » |

---

### Task 1: Schéma et champs existants

**Files:**
- Modify: `apps/api/prisma/schema.prisma`, `apps/api/src/documents/documents.service.ts` (review), `apps/api/src/prospects/prospects.service.ts` (convert), `apps/api/src/prospects/dto/prospect.dto.ts`, `apps/api/src/candidates/dto/*.ts`, `apps/api/src/public/dto/lead.dto.ts`, `apps/api/src/public/leads.service.ts`
- Test: `documents.service.spec.ts` (nouveau ou existant), `prospects.service.spec.ts`, `leads.service.spec.ts`

**Interfaces — Produces:**
- `enum Language { fr ar }`, puis `Candidate.preferredLanguage Language @default(fr)` et `Prospect.preferredLanguage Language @default(fr)`.
- `CandidateDocument.reviewedAt DateTime?`
- `enum ReminderKind { APPOINTMENT_TOMORROW VISA_APPOINTMENT_TOMORROW PROSPECT_FOLLOW_UP INVOICE_OVERDUE DOCUMENT_REJECTED DAILY_DIGEST }`
- `enum ReminderChannel { EMAIL NOTIFICATION WHATSAPP }`, `enum ReminderStatus { SENT SKIPPED FAILED }`
- `model ReminderLog { id, organizationId, kind ReminderKind, entityType String, entityId String, channel ReminderChannel, dedupeKey String, status ReminderStatus, error String?, sentById String?, createdAt }`. Clé `@@unique([organizationId, dedupeKey])` et index `[organizationId, createdAt]`.
- **Ruling déjà prise :** seule une ligne `SENT` porte la clé exacte et verrouille donc la relance. Les lignes `SKIPPED` et `FAILED` sont enregistrées avec une clé suffixée par l'horodatage (`<clé>#<ISO>`). Elles restent dans l'historique, mais n'entrent jamais en conflit et ne bloquent rien.
- `enum MessageChannel { WHATSAPP EMAIL }`, puis `model MessageTemplate { id, organizationId, key String, channel MessageChannel, nameFr, nameAr, subjectFr String?, subjectAr String?, bodyFr, bodyAr, isSystem Boolean @default(false), updatedAt @updatedAt, @@unique([organizationId, key, channel]) }`
- `NotificationType` + `REMINDER`, `DAILY_DIGEST`.
- **Ruling déjà prise :** la contrainte unique sur (`organizationId`, `dedupeKey`, `status`) permet plusieurs lignes `SKIPPED`/`FAILED` historiques. Comme on ne crée qu'une seule ligne `SENT` par clé, c'est **elle** qui verrouille la clé. Les lignes `SKIPPED`/`FAILED` sont créées avec un suffixe horodaté dans `dedupeKey` (`<clé>#<ISO>`), pour ne jamais entrer en conflit.

- [ ] **Step 1 : tests.**
  - `review() renseigne reviewedAt` : après `review(…{ status: 'REJECTED' })`, `prisma.candidateDocument.update` est appelé avec `data.reviewedAt` instance de `Date`.
  - `convert() conserve la langue préférée` : un prospect `preferredLanguage: 'ar'` → `candidate.create` reçoit `preferredLanguage: 'ar'`.
  - `un lead créé depuis la version arabe a la langue ar` : `CreateLeadDto.locale = 'ar'` → `prospect.create` reçoit `preferredLanguage: 'ar'`. Ajouter `@IsOptional() @IsIn(['fr','ar']) locale?` au DTO.
- [ ] **Step 2 :** `npx jest documents prospects leads` → FAIL.
- [ ] **Step 3 :** schéma + `npx prisma db push && npx prisma generate`. Implémenter. Ajouter `@IsOptional() @IsIn(['fr','ar']) preferredLanguage?` aux DTO de création et de mise à jour candidat/prospect.
- [ ] **Step 4 :** gate API → PASS.
- [ ] **Step 5 :** commit `feat(api): schéma des relances, modèles de messages et langue préférée`.

### Task 2: Fonctions pures (fuseau et remplissage des modèles)

**Files:**
- Create: `apps/api/src/reminders/time.ts`, `apps/api/src/reminders/time.spec.ts`, `apps/api/src/message-templates/render.ts`, `apps/api/src/message-templates/render.spec.ts`, `apps/api/src/message-templates/defaults.ts`

**Interfaces — Produces:**
- `dayRange(now: Date, timeZone: string, offsetDays: number): { start: Date; end: Date }` : début inclus et fin exclue de la journée locale `aujourd'hui + offsetDays`, en instants UTC. Utiliser `Intl.DateTimeFormat` (aucune dépendance).
- `localHour(now: Date, timeZone: string): number` (0–23) ; `localDateKey(now: Date, timeZone: string): string` (`YYYY-MM-DD`).
- `type TemplateVars = Partial<Record<'prenom'|'nom'|'date'|'heure'|'lieu'|'pays'|'montant'|'devise'|'facture'|'document'|'raison'|'agence'|'telephone_agence', string>>`
- `renderTemplate(body: string, vars: TemplateVars): string` : remplace `{nom_variable}`. Toute accolade restante `{…}` (inconnue ou vide) est retirée, ainsi qu'un séparateur orphelin (` : `, ` · `, `,`) collé à elle. Les espaces multiples sont réduits.
- `formatDateFor(lang: 'fr'|'ar', date: Date, timeZone: string): { date: string; heure: string }`. Locales `fr-TN` / `ar-TN`.
- `DEFAULT_TEMPLATES: { key: string; channel: 'WHATSAPP'|'EMAIL'; isSystem: boolean; nameFr; nameAr; subjectFr?; subjectAr?; bodyFr; bodyAr }[]`. Clés : `APPOINTMENT_TOMORROW`, `VISA_APPOINTMENT_TOMORROW`, `PROSPECT_FOLLOW_UP`, `INVOICE_OVERDUE`, `DOCUMENT_REJECTED` (WHATSAPP + EMAIL, `isSystem: true`), `DAILY_DIGEST` (EMAIL, `isSystem: true`), `DOCUMENTS_LIST`, `VISA_STEPS`, `WELCOME` (WHATSAPP, `isSystem: false`). Ton chaleureux, vouvoiement, court ; arabe standard.

- [ ] **Step 1 : tests.**
  - `dayRange` : pour `now = 2026-11-16T22:30:00Z` à Tunis (UTC+1, donc 23:30 locale le 16), `offsetDays 1` → `start = 2026-11-16T23:00:00Z`, `end = 2026-11-17T23:00:00Z`.
  - `localHour(2026-11-16T06:10:00Z, 'Africa/Tunis') === 7`.
  - `renderTemplate('Bonjour {prenom}, RDV le {date} à {heure}', { prenom: 'Yasmine', date: '17/11/2026', heure: '10:00' })` → `'Bonjour Yasmine, RDV le 17/11/2026 à 10:00'`.
  - `variable inconnue retirée` : `renderTemplate('Bonjour {prénom} !', {})` → `'Bonjour !'`, et le résultat ne contient pas `{`.
  - `variable vide retirée avec son séparateur` : `renderTemplate('Lieu : {lieu}', { lieu: '' })` → `'Lieu'`.
  - Arabe : `renderTemplate('مرحبًا {prenom}', { prenom: 'ياسمين' })` → `'مرحبًا ياسمين'`.
  - `DEFAULT_TEMPLATES` : chaque modèle système existe en WHATSAPP et EMAIL (sauf `DAILY_DIGEST`, EMAIL seulement) ; chaque `bodyFr`/`bodyAr` n'utilise que des variables de `TemplateVars`.
- [ ] **Step 2 :** `npx jest time render` → FAIL.
- [ ] **Step 3 :** implémenter.
- [ ] **Step 4 :** PASS.
- [ ] **Step 5 :** commit `feat(api): fuseau horaire et remplissage des modèles (fonctions pures testées)`.

### Task 3: Service et API des modèles de messages

**Files:**
- Create: `apps/api/src/message-templates/message-templates.{service,controller,module}.ts` + `dto/message-template.dto.ts` + `message-templates.service.spec.ts`
- Modify: `apps/api/src/app.module.ts`, `apps/api/prisma/seed.ts`, `apps/api/src/platform-admin/platform-admin.service.ts` (après `agencySettings.create`)

**Interfaces — Produces:**
- `ensureDefaults(organizationId: string): Promise<void>` : crée les modèles manquants (`createMany skipDuplicates`), sans jamais écraser.
- `list(actor)` (après `ensureDefaults`), `update(actor, id, dto)`, `reset(actor, id)` (remet les textes par défaut).
- `renderFor(organizationId, key, channel, lang: 'fr'|'ar', vars: TemplateVars): Promise<{ subject?: string; body: string }>` : complète `agence` et `telephone_agence` depuis `AgencySettings`.
- Routes : `GET /message-templates` (`settings.view`) ; `PATCH /message-templates/:id` (`settings.manage`) ; `POST /message-templates/:id/reset` (`settings.manage`) ; `GET /message-templates/render?key=&channel=&entityType=CANDIDATE|PROSPECT&entityId=` (`candidate.view` ou `prospect.view`), qui renvoie le texte rempli avec les données du dossier, dans sa langue préférée.
- DTO `UpdateMessageTemplateDto` : `nameFr`, `nameAr` (≤ 80), `subjectFr`, `subjectAr` (≤ 160, optionnels), `bodyFr`, `bodyAr` (1–2000).

- [ ] **Step 1 : tests.**
  - `ensureDefaults crée les modèles manquants sans écraser` : `createMany` appelé avec `skipDuplicates: true`.
  - `renderFor choisit la langue et remplit l'agence`.
  - `update refuse un modèle d'une autre agence` (404).
  - `reset remet le texte par défaut`.
- [ ] **Step 2 :** FAIL. **Step 3 :** implémenter, appeler `ensureDefaults` dans le seed et à la création d'agence. **Step 4 :** gate API PASS.
- [ ] **Step 5 :** commit `feat(api): modèles de messages modifiables (FR/AR)`.

### Task 4: Détection des relances

**Files:**
- Create: `apps/api/src/reminders/reminders.detect.ts`, `apps/api/src/reminders/reminders.detect.spec.ts`

**Interfaces — Produces:**
```ts
export type ReminderTarget = { type: 'CANDIDATE' | 'PROSPECT'; id: string; firstName: string; lastName: string;
  phone: string | null; email: string | null; preferredLanguage: 'fr' | 'ar'; assignedToId: string | null };
export type DetectedReminder = {
  kind: Exclude<ReminderKind, 'DAILY_DIGEST'>;
  entityType: 'APPOINTMENT' | 'VISA_FILE' | 'PROSPECT' | 'INVOICE' | 'DOCUMENT';
  entityId: string;
  target: ReminderTarget;
  vars: TemplateVars;          // valeurs brutes (date ISO, montant…), formatées par le service selon la langue
  at: Date | null;             // date de l'événement (rendez-vous, échéance, rejet)
  cycle: string;               // partie variable de la clé : '' (une fois), 'YYYY-MM-DD' (par jour), 'c<n>' (cycle de 7 jours de la facture)
};
export function detectReminders(prisma: PrismaService, organizationId: string, now: Date, timeZone: string): Promise<DetectedReminder[]>;
```
- Règles = spec §4 + §13.2 et §13.4 (cycle facture = `floor(jours de retard / 7)`, prospect = date locale du jour).
- [ ] **Step 1 : tests** (Prisma simulé, comme `health-score.service.spec.ts`). Un test par ligne du §4, plus :
  - `détecte un rendez-vous à 00:30 locale demain` et `ignore un rendez-vous à 23:30 locale aujourd'hui` ;
  - `ignore rendez-vous annulé`, `ignore candidat archivé`, `ignore prospect converti/perdu`, `ignore facture soldée` ;
  - `ignore un document rejeté s'il existe une version plus récente du même type` ; `ignore un rejet de plus de 7 jours` ; `ignore un rejet sans reviewedAt` ;
  - `toutes les requêtes filtrent organizationId` (inspection des `where` passés à Prisma).
- [ ] **Step 2 :** FAIL. **Step 3 :** implémenter. **Step 4 :** PASS.
- [ ] **Step 5 :** commit `feat(api): détection des relances`.

### Task 5: Tournée du matin, journal et réveils

**Files:**
- Create: `apps/api/src/reminders/reminders.service.ts`, `reminders.module.ts`, `jobs.controller.ts`, `reminders.service.spec.ts`, `jobs.controller.spec.ts`
- Modify: `apps/api/src/config/env.ts` (`JOBS_SECRET?: string(min 24)`, `REMINDERS_CRON_ENABLED` 'true'|'false' défaut true), `apps/api/package.json` (`@nestjs/schedule`), `app.module.ts`, `.env.example`, `README.md` (section « Relances »)

**Interfaces — Produces:**
- `dedupeKeyFor(r: DetectedReminder, channel: ReminderChannel): string` = `${kind}:${channel}:${entityId}${cycle ? ':' + cycle : ''}`.
- `runForOrganization(organizationId: string, now: Date): Promise<RunSummary>`. Algorithme :
  - pour chaque relance, avec un e-mail si le §4 en prévoit un et une notification si c'en est une :
    - la clé est-elle déjà `SENT` (`findFirst status SENT`) ? alors on passe ;
    - facture : `n = nombre de SENT EMAIL pour cette facture` ; si `n >= 3`, ou si le dernier SENT date de moins de 7 jours, on passe ;
    - destinataire sans e-mail, ou SMTP absent (`MailService.isConfigured()`, à ajouter) : on enregistre `SKIPPED` (clé suffixée `#<ISO>`) ;
    - sinon, on **insère** `SENT`. En cas de P2002, une autre tournée a gagné : on passe. Puis on envoie. Si l'envoi échoue, on supprime la ligne `SENT`, on enregistre `FAILED` avec l'erreur, et on continue.
  - après chaque `SENT` : une entrée de chronologie (type `EMAIL`, texte FR « Rappel envoyé par e-mail : <nom du modèle> ») sur le candidat ou le prospect.
  - `DAILY_DIGEST` : pour chaque `User` actif (`isActive`, `deletedAt null`) qui a au moins un élément (relances assignées + rendez-vous du jour + tâches dues aujourd'hui), une notification `DAILY_DIGEST` et un e-mail dans sa `locale`. Clé `DAILY_DIGEST:EMAIL:<userId>:<date locale>`.
- `type RunSummary = { organizationId: string; counts: Record<string, { SENT: number; SKIPPED: number; FAILED: number }> }`.
- `runDue(now: Date, mode: 'cron' | 'external'): Promise<RunSummary[]>`. `cron` traite les agences où `localHour === 7`. `external` traite toutes les agences dont aucun `DAILY_DIGEST` ni log du jour local n'existe, ou simplement toutes, puisque l'opération est idempotente : choisir **toutes**.
- `@Cron('0 * * * *')` dans le service : `if (REMINDERS_CRON_ENABLED) runDue(new Date(), 'cron')`, entouré d'un try/catch avec log.
- `JobsController` `@Public()` `POST /jobs/daily-reminders` : 404 si `JOBS_SECRET` absent ; 401 si l'en-tête `Authorization: Bearer` diffère (`timingSafeEqual` sur des buffers de même longueur) ; 200 avec `RunSummary[]` sinon. `@Throttle({ default: { limit: 5, ttl: 60_000 } })`.

- [ ] **Step 1 : tests.**
  - `envoie l'e-mail de rappel de rendez-vous et journalise SENT`.
  - `deux tournées concurrentes n'envoient qu'une fois` : la seconde insertion lève `{ code: 'P2002' }` → `mail.send` appelé une fois.
  - `un SKIPPED ne verrouille pas la clé` : 1re tournée sans e-mail candidat → SKIPPED ; 2e tournée avec e-mail → SENT.
  - `facture : au plus 3 e-mails, 7 jours d'écart`.
  - `un échec d'envoi n'arrête pas la tournée et libère la clé` (FAILED, ligne SENT supprimée, relance suivante traitée).
  - `récapitulatif ignore les employés inactifs`.
  - `cron ne traite que les agences à 07:xx locale`.
  - Jobs : `404 sans JOBS_SECRET`, `401 mauvaise clé`, `200 bonne clé`.
- [ ] **Step 2 :** FAIL. **Step 3 :** `npm i @nestjs/schedule` (version compatible NestJS 11), implémenter. **Step 4 :** gate API PASS.
- [ ] **Step 5 :** commit `feat(api): tournée du matin des relances (planificateur + route sécurisée, sans doublon)`.

### Task 6: API « Relances du jour »

**Files:**
- Create: `apps/api/src/reminders/reminders.controller.ts`, `dto/reminder-done.dto.ts`, `reminders.controller.spec.ts` (ou des tests sur le service)
- Modify: `reminders.service.ts`

**Interfaces — Produces:**
- `GET /reminders/today?scope=mine|all` (`candidate.view` ou `prospect.view`) → `{ items: TodayReminder[]; doneToday: TodayReminder[] }` avec
  `TodayReminder = { key: string; kind; entityType; entityId; target: { type; id; name; phone; preferredLanguage }; at: string|null; summary: Record<string,string>; autoChannel: { channel: 'EMAIL'|'NOTIFICATION'; status: 'SENT'|'SKIPPED'|'FAILED'; at: string } | null; assignedToId: string|null; unassigned: boolean }`.
  `mine` = `target.assignedToId === actor.id` **plus** les non assignées dans une section à part (`unassigned: true`). `all` = toutes.
  `key` = `dedupeKeyFor(r, 'WHATSAPP')`. Une relance est « faite » si un `ReminderLog` `WHATSAPP`/`SENT` existe pour cette clé.
- `POST /reminders/done` body `{ key: string; nextFollowUpAt?: string | null }` : revalide que la clé correspond à une relance détectée maintenant pour l'agence (sinon 404). Insère un `ReminderLog` WHATSAPP SENT avec `sentById` (P2002 = déjà fait : renvoie 200). Ajoute une entrée de chronologie `NOTE` « Relance WhatsApp envoyée : <nom du modèle> ». Pour un `PROSPECT_FOLLOW_UP` avec `nextFollowUpAt` fourni, met à jour le prospect (`null` = plus de relance).
- [ ] **Step 1 : tests.** `mine ne renvoie que mes relances + non assignées`, `done revalide la clé (404 si inconnue)`, `done est idempotent`, `done met à jour nextFollowUpAt du prospect`, `done refuse une clé d'une autre agence`.
- [ ] **Step 2 :** FAIL. **Step 3 :** implémenter. **Step 4 :** PASS.
- [ ] **Step 5 :** commit `feat(api): relances du jour et marquage « fait »`.

### Task 7: Web — langue préférée et types

**Files:**
- Modify: `apps/web/src/lib/types.ts`, `apps/web/src/features/candidates/candidate-form.tsx`, `apps/web/src/features/prospects/prospect-form.tsx`, `apps/web/src/lib/schemas.ts`, le formulaire de contact de l'accueil et le simulateur (envoyer `locale`), `messages/{fr,ar}.json`
- [ ] **Step 1 :** ajouter `preferredLanguage: 'fr' | 'ar'` aux types Candidate et Prospect ; un `Select` « Langue préférée » (« Français », « العربية ») dans les deux formulaires, avec la langue courante de l'interface par défaut à la création ; `locale` envoyé par les deux formulaires publics.
- [ ] **Step 2 :** gate web PASS. Puis, avec l'API lancée, créer un lead en arabe depuis `/ar` et vérifier que le prospect a `preferredLanguage = 'ar'` (`curl` sur `/api/prospects/:id`).
- [ ] **Step 3 :** commit `feat(web): langue préférée des candidats et prospects`.

### Task 8: Web — page « Relances du jour »

**Files:**
- Create: `apps/web/src/features/reminders/{reminders-page,reminders-widget,next-follow-up-dialog}.tsx`, `apps/web/src/app/[locale]/(admin)/reminders/page.tsx`, `apps/web/src/lib/reminder-text.ts` + `apps/web/scripts/tests/reminder-text.test.mjs`
- Modify: `apps/web/src/components/nav.ts` (entrée « Relances », icône `BellRing`, visible si `candidate.view` ou `prospect.view`), `features/dashboard/dashboard-page.tsx` (widget), `messages/{fr,ar}.json`, `scripts/visual-check.mjs` (`/reminders` dans `ADMIN_PAGES`)

**Interfaces — Consumes:** Task 6 (`GET /reminders/today`, `POST /reminders/done`), Task 3 (`GET /message-templates/render`).
- `buildWhatsappUrl(phone: string, text: string): string | null` dans `reminder-text.ts` : `null` si le téléphone a moins de 8 chiffres ; sinon `whatsappLink`. Test : texte arabe encodé ; `null` pour `''`.
- Page :
  - en-tête avec compteurs « à faire / faites » ;
  - bascule « Mes relances / Toute l'agence » ;
  - sections « À faire », « Non assignées », « Faites aujourd'hui » ;
  - lignes en `Card` avec un `Badge` de situation, le nom (lien vers le dossier), le résumé (date, montant…) et la puce « e-mail envoyé ce matin » ou « e-mail impossible : pas d'adresse » ;
  - bouton **WhatsApp** : récupère le texte rendu, ouvre `window.open(url, '_blank')`, puis `POST /reminders/done`. Pour un prospect, il ouvre ensuite `NextFollowUpDialog` (date par défaut à J+3, bouton « Aucune »). Le bouton est désactivé sans téléphone, avec une infobulle ;
  - état vide : `EmptyState` « Aucune relance aujourd'hui ».
- Widget du tableau de bord : tuile « Relances du jour : n à faire », lien vers `/reminders`.
- [ ] **Step 1 :** test `reminder-text.test.mjs` (RED), puis implémenter (GREEN).
- [ ] **Step 2 :** page, widget et dialogue ; gate web PASS.
- [ ] **Step 3 :** `visual-check --only /reminders` PASS en fr et ar, à 1280 et 390, avec des données de démonstration : un rendez-vous demain, un prospect à relancer aujourd'hui, une facture en retard. Ajouter le test `reminders-whatsapp-text` : intercepter `window.open`, cliquer sur le premier WhatsApp, vérifier que l'URL commence par `https://wa.me/` et que le texte décodé ne contient pas `{`.
- [ ] **Step 4 :** commit `feat(web): page « Relances du jour »`.

### Task 9: Web — modèles de messages et « Envoyer un message »

**Files:**
- Create: `apps/web/src/features/message-templates/{templates-page,send-message-dialog}.tsx`, `apps/web/src/app/[locale]/(admin)/settings/messages/page.tsx`
- Modify: `features/settings/settings-page.tsx` (section « Messages » avec un lien vers `/settings/messages`), `features/candidates/candidate-detail-page.tsx` (bouton « Envoyer un message » à côté de WhatsApp), `features/prospects/prospects-page.tsx` (action « Envoyer un message » par ligne), `messages/{fr,ar}.json`
- Page des modèles :
  - liste groupée « Relances automatiques » / « Messages libres », avec un badge du canal ;
  - édition FR et AR côte à côte (`Textarea`), puces de variables cliquables qui insèrent `{variable}` au curseur ;
  - aperçu en direct avec des valeurs d'exemple, via un `renderTemplate` web : copier la règle de Task 2 dans `apps/web/src/lib/render-template.ts`, avec un test `node --test` identique aux cas de Task 2 ;
  - boutons « Enregistrer » et « Rétablir le texte par défaut » (`ConfirmDialog`). Lecture seule sans `settings.manage`.
- `SendMessageDialog({ entityType, entityId, phone })` : choix d'un modèle WhatsApp, texte rendu par l'API (modifiable), puis « Ouvrir WhatsApp ». Cela crée une entrée de chronologie via l'endpoint existant des notes de chronologie (type `NOTE`, « Message WhatsApp : <nom> »).
- [ ] **Step 1 :** test `render-template.test.mjs` (RED → GREEN).
- [ ] **Step 2 :** implémenter ; gate web PASS.
- [ ] **Step 3 :** `visual-check` : ajouter `/settings/messages` à `ADMIN_PAGES` ; PASS en fr et ar, à 1280 et 390.
- [ ] **Step 4 :** commit `feat(web): modèles de messages et envoi en un clic`.

### Task 10: Vérification de bout en bout et compte rendu

- [ ] **Step 1 :** données locales : un rendez-vous demain, une facture en retard de 8 jours, un prospect à relancer et un document rejeté hier pour Yasmine (e-mail renseigné). Lancer Mailpit/MailHog si disponible (`SMTP_HOST=localhost`, port 1025). Sinon, garder le mode journal.
- [ ] **Step 2 :** `curl -X POST -H "Authorization: Bearer $JOBS_SECRET" localhost:4000/api/jobs/daily-reminders` doit donner les compteurs attendus (SENT avec SMTP, SKIPPED sans). Un second appel ne doit **aucun** nouveau SENT.
- [ ] **Step 3 :** build de production web, puis `npm run visual-check -- --shots` : tout PASS. Captures relues, puis page de captures (artefact).
- [ ] **Step 4 :** push. Relecture finale indépendante. Compte rendu au propriétaire, avec ce qu'il doit configurer en production : `SMTP_*`, `JOBS_SECRET`, Vercel Cron facultatif.
