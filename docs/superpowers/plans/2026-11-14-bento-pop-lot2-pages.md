# Bento Pop — Lot 2 (pages clés) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refaire en profondeur les pages à fort impact (spec §6.3) sur les fondations Bento Pop du lot 1 : accueil et pages publiques en grille bento, tableaux de bord animés, dossier candidat, portail candidat mobile, Kanban des prospects, portail partenaire.

**Architecture:** Les pages consomment les briques du lot 1 (`components/motion.tsx`, `components/ui/*`, `features/public/design-system.tsx`). Une seule logique nouvelle, pure et testée, calcule les widgets du portail candidat à partir de routes API **existantes** (`lib/portal-progress.ts`). Les données, requêtes, permissions et textes métier de chaque page restent identiques. Seuls la mise en page, le style et l'animation changent, plus les nouveaux libellés de widgets.

**Tech Stack:** Next.js 15, React 19, Tailwind 3.4, next-intl (fr/ar), Framer Motion 11, TanStack Query, `node --test` (type stripping natif de Node 22) pour la logique pure, Playwright via `scripts/visual-check.mjs`.

**Spec:** `docs/superpowers/specs/2026-11-14-bento-pop-redesign-design.md` (§5.4, §6.3, §8.1–8.4). Plan précédent : `docs/superpowers/plans/2026-11-14-bento-pop-lot1-fondations.md`.

## Global Constraints

- Aucun changement d'API, de base, de requête existante, de permission ni de texte métier. Les seules nouvelles requêtes autorisées : `GET /portal/invoices` sur le tableau de bord du portail (route existante).
- Une seule couleur décorative : `primary` (`#2457FF`), plus l'encre. Les couleurs d'état (succès, danger, avertissement) servent seulement à signaler un état. Aucune couleur codée en dur (`#…`) dans les pages, sauf `#25D366` pour WhatsApp.
- Admin et portails : pas de boucle infinie près des données. Anneaux et barres se remplissent **une fois**. Seule exception : le point qui pulse sur l'étape en cours du parcours candidat. Site public : boucles autorisées (bandeau, formes, autocollant).
- Animations coupées en mouvement réduit (règle CSS du lot 1 + `useReducedMotion` dans les composants Framer).
- Tout nouveau texte visible va dans `messages/fr.json` ET `messages/ar.json`. `node scripts/check-i18n.mjs` doit passer.
- Mises en page vérifiées en RTL. Utiliser les propriétés logiques (`ms-`, `me-`, `start-`, `end-`, `ps-`, `pe-`), jamais `left-`/`right-`/`ml-`/`mr-` dans le nouveau code.
- Gate de chaque tâche : `npm run typecheck && node scripts/check-i18n.mjs && npm run test:unit`, plus `visual-check` sur les pages touchées (serveur de dev lancé).

## Review Focus

1. **Données vides** (aucune candidature, aucune facture, checklist vide, aucun rendez-vous) : chaque nouveau widget affiche un état vide lisible, jamais `NaN %`, `0/0` ni un anneau cassé. C'est testé dans `portal-progress.test.mjs` (Task 1) et par la capture du compte de démonstration vide (Task 9).
2. **Plusieurs devises** dans les factures du candidat : le « reste à payer » ne mélange jamais TND et EUR (Task 1, test `outstanding sépare les devises`).
3. **Textes longs** (nom d'université, titre de programme ou d'article sur deux ou trois lignes, en arabe) : les tuiles bento grandissent au lieu de couper ou de déborder. C'est vérifié par `no-hscroll` à 390 px sur chaque page touchée.
4. **Contenu géré par le Super Admin** (titre, image et services de l'accueil venant du CMS) : la nouvelle mise en page garde exactement les mêmes branches CMS / repli (Task 3, revue du diff : chaque `pick(...)` et `content?.…` existant est conservé).
5. **Glisser-déposer du Kanban** au clavier et au toucher : l'inclinaison est purement visuelle et ne change ni les gestionnaires ni les attributs `draggable` (Task 7, diff limité aux classes).

---

## File Structure

| Fichier | Responsabilité |
|---|---|
| `apps/web/src/lib/portal-progress.ts` | **nouveau** : `checklistCompletion`, `outstandingBalance`, `candidateJourney` (pur, sans import) |
| `apps/web/scripts/tests/portal-progress.test.mjs` | **nouveau** : tests `node --test` |
| `apps/web/src/components/progress-ring.tsx` | **nouveau** : anneau SVG qui se remplit une fois |
| `apps/web/src/features/portal/portal-dashboard-page.tsx` | tableau de bord bento du candidat |
| `apps/web/src/features/public/public-landing-page.tsx` | accueil en bento |
| `apps/web/src/features/public/design-system.tsx` | + `PublicPageHero` |
| `apps/web/src/features/public/*-page.tsx` | pages publiques restylées |
| `apps/web/src/features/dashboard/*`, `command-center/command-center-page.tsx` | tableaux de bord admin |
| `apps/web/src/features/candidates/candidate-detail-page.tsx`, `health-score-card.tsx` | dossier candidat |
| `apps/web/src/features/prospects/prospects-board.tsx` | Kanban |
| `apps/web/src/features/partner-portal/partner-dashboard-page.tsx` | portail partenaire |

---

### Task 1: Logique du portail candidat (TDD) et lanceur de tests

**Files:**
- Create: `apps/web/src/lib/portal-progress.ts`, `apps/web/scripts/tests/portal-progress.test.mjs`
- Modify: `apps/web/package.json` (script `"test:unit": "node --test scripts/tests/"`)

**Interfaces — Produces:**
- `checklistCompletion(items: { status: 'PENDING' | 'DONE' | 'NOT_APPLICABLE' }[]): number | null` : arrondi de (DONE + NOT_APPLICABLE) / total × 100 ; `null` si la liste est vide.
- `outstandingBalance(invoices: { status: string; currency: string; items: { quantity: number; unitPrice: number }[]; payments: { amount: number }[] }[]): { currency: string; amount: number }[]` : seulement `ISSUED` et `PARTIALLY_PAID` ; total des lignes − paiements ; regroupé par devise ; seuls les montants > 0 ; trié par devise.
- `type StepState = 'done' | 'current' | 'upcoming'`
- `candidateJourney(apps: { status: string }[], visas: { status: string }[]): { admission: StepState; visa: StepState; departure: StepState }`. Table de correspondance :

| Situation | admission | visa | departure |
|---|---|---|---|
| aucune candidature `ACCEPTED` | current | upcoming | upcoming |
| ≥ 1 `ACCEPTED`, aucun visa `APPROVED` | done | current | upcoming |
| ≥ 1 `ACCEPTED` et ≥ 1 visa `APPROVED` | done | done | current |
| aucune `ACCEPTED` mais un visa `APPROVED` (saisie atypique) | done | done | current |

- [ ] **Step 1 :** Écrire les tests dans `portal-progress.test.mjs` (import `../../src/lib/portal-progress.ts`) :
  - `checklistCompletion([])` → `null` ; `[DONE, NOT_APPLICABLE, PENDING, PENDING]` → `50` ; `[DONE, DONE, PENDING]` → `67`.
  - `outstanding ignore payées, brouillons et annulées` : seule l'`ISSUED` (2 × 300, payé 100) compte → `[{ currency: 'TND', amount: 500 }]`.
  - `outstanding sépare les devises` : une TND (reste 200) et une EUR (reste 50) → `[{EUR,50},{TND,200}]`.
  - `outstanding entièrement payée en PARTIALLY_PAID` (reste 0) → `[]`.
  - Une assertion `candidateJourney` par ligne de la table, plus `([], [])` → ligne 1.
- [ ] **Step 2 :** `npm run test:unit`. Attendu : FAIL (module introuvable).
- [ ] **Step 3 :** Implémenter `portal-progress.ts`, sans aucun import, pour qu'il soit importable par `node --test`.
- [ ] **Step 4 :** `npm run test:unit` → PASS ; `npm run typecheck` → OK.
- [ ] **Step 5 :** Commit `feat(web): logique de progression du portail candidat (testée)`.

### Task 2: Tableau de bord du portail candidat

**Files:**
- Create: `apps/web/src/components/progress-ring.tsx`
- Modify: `apps/web/src/features/portal/portal-dashboard-page.tsx`, `apps/web/src/components/portal-bottom-nav.tsx`, `apps/web/src/components/providers.tsx`, `messages/{fr,ar}.json`

**Interfaces:**
- Consumes : Task 1 ; `CountUp`, `StaggerGroup/Item` (`components/motion.tsx`) ; `Card`.
- Produces : `ProgressRing({ value: number | null; size?: number = 88; stroke?: number = 10; label: string; tone?: 'onBlue' | 'onWhite' = 'onWhite' })`. C'est un SVG à deux cercles : le cercle de progression part de 0 et se remplit une fois (Framer `pathLength`, 0,9 s, `SPRING` désactivé en mouvement réduit). Avec `value=null`, il affiche « – ». `role="img"` et `aria-label={label}`.

- [ ] **Step 1 : Mise en page.** Grille bento (`grid gap-3 sm:grid-cols-2 lg:grid-cols-4`), dans cet ordre :
  1. **Grand bloc bleu** (`lg:col-span-2 lg:row-span-2`) : le titre `welcome` existant, `dashboardSubtitle`, puis l'anneau de complétude (`checklistCompletion`) avec le libellé `portal.completionLabel` (« Dossier complété » / « اكتمال الملف ») et l'indication `portal.pendingChecklist` + nombre.
  2. **Parcours** (`lg:col-span-2`) : trois étapes `portal.journeyAdmission` / `journeyVisa` / `journeyDeparture` (« Admission » / « Visa » / « Départ » ; « القبول » / « التأشيرة » / « السفر »). Étape done = coche dans un carré bleu ; current = numéro avec un point qui pulse (`animate-ping` sur un pseudo-point, seule boucle autorisée) ; upcoming = numéro grisé. Lien vers `/portal/applications`.
  3. **Prochain rendez-vous** : la date du premier rendez-vous (logique existante, date au format `toLocaleDateString(locale)`). Lien vers `/portal/appointments`.
  4. **Reste à payer** : `outstandingBalance` sur `GET /portal/invoices`, une ligne par devise avec `CountUp`. Si la liste est vide : `portal.nothingToPay` (« Tout est réglé » / « لا شيء للدفع »). Lien vers `/portal/finance`.
  5. **Candidatures** et **Dossiers visa** : les deux compteurs existants, en `CountUp`.
  6. **Bouton pleine largeur** « Déposer un document » (clé existante `portal.uploadDocument`), vers `/portal/documents`, en `StudyWorldButton` style primary.
- [ ] **Step 2 :** Supprimer `CARD_ACCENTS` : les icônes passent en pastille `bg-primary-soft text-primary` (blanc sur le bloc bleu).
- [ ] **Step 3 :** Squelette de chargement : `StatCardsSkeleton` remplacé par des blocs `Skeleton` aux mêmes emplacements de la grille.
- [ ] **Step 4 : Petits défauts du lot 1 liés au portail.**
  - Barre du bas : libellés `text-[11px]` → `text-[10px] leading-tight` avec un retour à la ligne autorisé sur 2 lignes (`line-clamp-2`) au lieu de `truncate`.
  - Toaster : `offset` / `mobileOffset` en bas = `96px` sous `md` pour ne pas masquer la barre (prop `mobileOffset={{ bottom: 96 }}` de sonner 2).
- [ ] **Step 5 :** Typecheck, i18n et tests unitaires ; `visual-check --only /portal/dashboard` PASS (fr/ar, 1280/390).
- [ ] **Step 6 :** Commit `feat(web): tableau de bord bento du portail candidat`.

### Task 2b: Écran de chargement avec le logo (choix du propriétaire : option 1 « Logo qui saute »)

Maquette de référence : https://claude.ai/artifact/NPaHg9LUytYdPTFuwujfpn (option 1).

**Files:**
- Create: `apps/web/src/components/page-loader.tsx`, `apps/web/src/app/[locale]/loading.tsx`
- Modify: `apps/web/src/components/{auth-guard,portal-auth-guard,partner-auth-guard}.tsx`, `apps/web/tailwind.config.ts` (keyframes `hop`, `loader-fill`)

**Interfaces — Produces:** `PageLoader({ fullscreen?: boolean = true })`.
- C'est un écran centré sur fond `bg-background`. On y voit le logo de l'agence : `agency.data.logoUrl` s'il existe (en `<img>` de hauteur 48 px, avec le nom de l'agence en `alt`), sinon `StudyWorldLogo`, dont le badge « in » saute grâce à l'animation `hop` (1 s, ressort).
- Dessous, une barre Pop de 180 × 14 px : contour encre 2 px, ombre `shadow-pop-sm`, remplissage bleu qui avance en boucle (`loader-fill`, 1,8 s). C'est une boucle, autorisée ici parce qu'il n'y a aucune donnée à côté.
- `role="status"` avec le texte caché `common.loading`. En mouvement réduit, il n'y a ni saut ni défilement : la barre reste remplie à moitié.
- L'écran ne s'affiche qu'après 150 ms (`animation-delay` sur l'opacité), pour éviter un flash sur les chargements très rapides.
- [ ] **Step 1 :** Ajouter la prop `animated?: boolean` à `StudyWorldLogo`, qui met la classe `animate-hop` sur le badge « in ».
- [ ] **Step 2 :** Implémenter `PageLoader`. `app/[locale]/loading.tsx` rend `<PageLoader />`. Les trois gardes d'authentification remplacent leur `LoaderCircle` + texte par `<PageLoader />`, avec la même condition d'affichage.
- [ ] **Step 3 :** Gate. Test Playwright ajouté à `visual-check` (`page-loader`) : en interceptant `**/api/auth/refresh` avec un délai de 2 s, `/fr/dashboard` affiche `[role=status]` contenant le logo, puis l'écran disparaît. PASS.
- [ ] **Step 4 :** Commit `feat(web): écran de chargement avec le logo de l'agence`.

### Task 3: Accueil du site public en bento

**Files:**
- Modify: `apps/web/src/features/public/public-landing-page.tsx`, `apps/web/src/features/public/design-system.tsx`

**Interfaces:** Consumes `BentoGrid`, `BentoTile`, `StatTile`, `Sticker`, `Marquee`, `MorphBlob`, `Reveal*`, `ServiceCard`, `DestinationCard`, `JourneyTimeline`, `StudyWorldButton`.

- [ ] **Step 1 : Accroche en grille bento** (`max-w-6xl`, `grid gap-3 lg:grid-cols-4 lg:grid-rows-[auto_auto]`).
  - **Grand bloc bleu** (`lg:col-span-2 lg:row-span-2`) : les deux `MorphBlob`, un `Sticker` avec `public.heroSticker` (« Rentrée 2027 » / « دخول 2027 »), le titre CMS ou de repli (mêmes branches `pick(...)`, avec `BrushTitle` en blanc sur bleu : `color="rgb(255 255 255 / 0.25)"`), le sous-titre, et les deux CTA existants (primary en blanc, texte bleu).
  - **Bloc image** (`lg:col-span-2`) : image CMS ou repli, dans un `AnimatedFrame` (voir ci-dessous) avec l'autocollant `public.heroImageSticker` (« Destination de rêve ✈ » / « وجهة الأحلام ✈ »).
  - **`AnimatedFrame({ children, sticker?: string, className })`** dans `design-system.tsx` (choix du propriétaire : option C « Pop qui respire », même maquette) : contour encre 3 px et double ombre encre + bleu qui grandit de 4 px à 10 px et revient (keyframes `breathe`, 2,6 s). L'image se penche de −1° à +1° pendant le cycle. Un `Sticker` optionnel est posé dans le coin supérieur de fin (`-top-3 -end-3`). Il est utilisé pour **toutes les images de l'accueil** : l'accroche, les cartes destinations qui ont une photo, et l'image « Qui sommes-nous ». Le décalage de l'ombre suit `--pop-x` (RTL). En mouvement réduit, le cadre reste fixe avec une ombre de 4 px.
  - **Deux tuiles** : `StatTile` pays et programmes (données réelles `stats`, suffixe « + ») ; masquées tant que `stats.data` est absent (comportement existant).
- [ ] **Step 2 :** `Marquee` des noms de destinations (`destinations.data`), sous l'accroche ; masqué si la liste est vide.
- [ ] **Step 3 :** Sections suivantes restylées sans changer leur contenu ni leurs conditions d'affichage.
  - Fonds alternés `bg-white` / `bg-sw-sky/10` / `bg-navy` remplacés par le fond de page. Chaque section est un conteneur `max-w-6xl` avec un titre `font-display text-4xl font-extrabold`.
  - « Qui sommes-nous » (`bg-navy`) devient un grand bloc `bg-primary rounded-tile .pop` à l'intérieur du conteneur.
  - Le guide gratuit et le formulaire de contact passent dans des blocs `Card variant="pop"`.
  - La FAQ devient une liste de blocs `.pop-soft` dont l'ouverture garde le mécanisme actuel.
- [ ] **Step 4 :** Ajouter `PublicPageHero({ eyebrow?: string; title: string; subtitle?: string; children?: ReactNode })` dans `design-system.tsx` : un bloc `bg-primary rounded-tile .pop` avec `MorphBlob`, titre blanc `font-display text-4xl sm:text-5xl` et les enfants (filtres, CTA) dessous. Il sert à la Task 4.
- [ ] **Step 5 :** Gate, puis `visual-check --only /` PASS, plus une capture pleine page relue à l'œil (fr 1280, ar 390).
- [ ] **Step 6 :** Commit `feat(web): accueil public en grille bento`.

### Task 4: Pages publiques

**Files:** `destinations-page.tsx`, `destination-detail-page.tsx`, `university-detail-page.tsx`, `programs-search-page.tsx`, `program-detail-page.tsx`, `programs-compare-page.tsx`, `eligibility-simulator-page.tsx`, `blog-list-page.tsx`, `blog-detail-page.tsx` (tous dans `features/public/`)

- [ ] **Step 1 :** Remplacer l'en-tête de chaque page de liste (destinations, programmes, simulateur, blog) par `PublicPageHero`, avec le même titre et le même sous-titre. Les filtres de recherche des programmes et le formulaire du simulateur vont dans un `Card variant="pop"` qui chevauche le bas du bloc (`-mt-10 relative`).
- [ ] **Step 2 : Pages de détail.**
  - Destination, université, programme : la bannière image passe dans un cadre `.pop rounded-tile`. Le titre est sur l'image dans une pastille blanche `.pop`. Les infos clés (coût, durée, langue, niveau…, champs existants) passent en tuiles bento `BentoGrid`.
  - Article de blog : colonne de lecture `max-w-prose`, titre `font-display`, image dans un cadre `.pop`.
- [ ] **Step 3 :** Cartes de résultats (programmes, articles, universités) : `Card hoverable` (Pop) avec un badge de niveau ou de langue en `Badge tone="primary"`. Le comparateur devient un tableau dans un `Card variant="pop"` à en-têtes collants.
- [ ] **Step 4 :** Gate ; `visual-check` sur `/destinations`, `/programs` et `/eligibility` (ajouter `/eligibility` et `/blog` à `PUBLIC_PAGES`) ; PASS.
- [ ] **Step 5 :** Commit `feat(web): pages publiques Bento Pop`.

### Task 5: Tableau de bord admin, échéances et Command Center

**Files:** `features/dashboard/dashboard-page.tsx`, `features/dashboard/deadlines-widget.tsx`, `features/command-center/command-center-page.tsx`

- [ ] **Step 1 : `dashboard-page`.**
  - Le premier élément de `cards` devient une tuile bleue (`Card variant="pop" className="bg-primary text-white"`). Les autres restent en `Card hoverable`.
  - Les valeurs passent en `CountUp`, et `–` s'affiche tant que la valeur est indéfinie.
  - Grille `sm:grid-cols-2 xl:grid-cols-3`, inchangée.
- [ ] **Step 2 : `deadlines-widget`.** Chaque échéance devient une ligne avec une pastille d'urgence : retard en `danger`, aujourd'hui en `Badge tone="primary"` plein, bientôt et à venir en `neutral`. Elle garde les mêmes groupes et le même filtrage.
- [ ] **Step 3 : `command-center`.** Les sections Aujourd'hui, Risques, Finance, Admissions et Visa deviennent une grille bento.
  - Les chiffres du jour passent en `CountUp`.
  - Les répartitions par statut (admissions, visa) deviennent des barres horizontales `bg-primary` qui se remplissent une fois (Framer `scaleX` 0 → valeur, `transform-origin` côté début, inversé en RTL via `origin-left rtl:origin-right`).
  - Les candidats à risque deviennent une liste de lignes `pop-soft` avec leurs raisons en `Badge`.
- [ ] **Step 4 :** Gate ; `visual-check --only /dashboard` PASS ; capture de `/command-center` relue à l'œil (fr et ar).
- [ ] **Step 5 :** Commit `feat(web): tableaux de bord admin animés`.

### Task 6: Dossier candidat

**Files:** `features/candidates/candidate-detail-page.tsx`, `features/candidates/health-score-card.tsx`

- [ ] **Step 1 : En-tête bento** (au-dessus des onglets).
  - Bloc identité `Card variant="pop"` : initiales dans un carré bleu, nom en `font-display text-3xl`, statut en `Badge`, téléphone et e-mail. Les actions existantes (WhatsApp, invitation au portail, résumé IA, modifier) gardent les mêmes boutons et gestionnaires.
  - À côté, la carte Health Score.
- [ ] **Step 2 : `health-score-card`.**
  - Le score devient un `ProgressRing` (Task 2) : `tone="onWhite"` ; anneau `success` si le score est ≥ 80, `primary` entre 50 et 79, `destructive` sous 50. Ce sont des couleurs d'état, autorisées.
  - Ajouter au `ProgressRing` une prop optionnelle `color?: 'primary' | 'success' | 'destructive'` (défaut `primary`).
  - La liste des problèmes et leurs gravités ne change pas.
- [ ] **Step 3 : Onglets.** Ce sont des pastilles `rounded-xl border-2`. L'onglet actif est en `border-ink bg-primary text-white shadow-pop-sm`, avec la même logique de sélection qu'aujourd'hui. La barre défile horizontalement (`overflow-x-auto`) sur téléphone.
- [ ] **Step 4 :** Gate ; `visual-check` : ajouter un candidat existant à `ADMIN_PAGES`, avec un chemin résolu dynamiquement par le premier lien `a[href*="/candidates/"]` de `/candidates`. PASS en fr/ar, 1280/390.
- [ ] **Step 5 :** Commit `feat(web): dossier candidat bento`.

### Task 7: Kanban des prospects

**Files:** `features/prospects/prospects-board.tsx`

- [ ] **Step 1 : Colonnes et cartes.**
  - Colonnes : blocs `pop-soft rounded-tile bg-muted/60`, avec un en-tête qui porte le nom du statut et un compteur dans un `Badge`.
  - Cartes : `Card hoverable`, avec le score chaud/tiède/froid existant en `Badge` (danger, primary ou neutral).
- [ ] **Step 2 : Pendant le glisser.** La carte en cours de déplacement prend `rotate-2 scale-[1.02] shadow-pop-lg`, via un état local `draggingId` mis à jour dans les gestionnaires `onDragStart`/`onDragEnd` existants (sans changer leur logique). La colonne survolée prend `border-primary border-dashed`.
- [ ] **Step 3 :** Gate ; capture `/prospects` relue (fr et ar). Glisser-déposer manuel avec Playwright (`dragTo`) d'une carte vers la colonne voisine : le statut change toujours.
- [ ] **Step 4 :** Commit `feat(web): Kanban des prospects Bento Pop`.

### Task 8: Tableau de bord du portail partenaire

**Files:** `features/partner-portal/partner-dashboard-page.tsx`

- [ ] **Step 1 :** Les chiffres existants passent en tuiles bento. La première est une tuile bleue avec `CountUp`. Les icônes ne sont plus multicolores : elles passent en pastille `bg-primary-soft text-primary`.
- [ ] **Step 2 :** Gate ; capture relue avec un compte partenaire de démonstration, créé en base locale s'il n'en existe pas (même méthode que le candidat de démonstration du lot 1, non commitée).
- [ ] **Step 3 :** Commit `feat(web): tableau de bord partenaire Bento Pop`.

### Task 9: Vérification finale, captures et compte rendu

- [ ] **Step 1 :** Build de production, `next start`, `visual-check --shots`. Tout passe.
- [ ] **Step 2 :** Captures relues à l'œil pour les 7 groupes de pages, en fr et ar, à 1280 et 390. Dont le portail candidat **vide** (compte de démonstration sans données) et **rempli** (une candidature ACCEPTED, un visa PREPARING, une facture ISSUED et quelques éléments de checklist, créés en base locale).
- [ ] **Step 3 :** Mettre à jour la page de captures (artefact) avec le lot 2.
- [ ] **Step 4 :** Push. Relecture finale indépendante de la branche entière depuis la fin du lot 1. Compte rendu au propriétaire.
