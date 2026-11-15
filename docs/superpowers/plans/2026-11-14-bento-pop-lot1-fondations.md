# Bento Pop — Lot 1 (fondations) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Appliquer l'identité Bento Pop à toute la plateforme web en changeant les tokens, les composants partagés et les cinq cadres, sans toucher à aucune fonctionnalité.

**Architecture:** Les couleurs, rayons, ombres et polices sont des variables CSS dans `globals.css`, exposées dans `tailwind.config.ts`. Chaque cadre pose `data-surface="public"|"app"` sur sa racine, et les composants `components/ui/*` changent d'intensité par CSS selon cet attribut (Pop complet ou Pop adouci). Leurs API restent identiques, donc les 68 fichiers consommateurs ne changent pas.

**Tech Stack:** Next.js 15, React 19, Tailwind 3.4, next-intl (fr/ar), Framer Motion 11, Radix Dialog, sonner, lucide-react, Playwright (préinstallé) pour la vérification visuelle.

**Spec:** `docs/superpowers/specs/2026-11-14-bento-pop-redesign-design.md` (§2, §5, §6.2, §8 en particulier)

## Global Constraints

- Périmètre : `apps/web` uniquement. Aucun changement d'API, de base, de logique, de permissions ni de texte métier existant.
- Aucune prop existante d'un composant `components/ui/*` n'est retirée ni renommée.
- Couleurs exactes : `--ink #0B1230`, `--primary #2457FF`, `--primary-soft #E4EBFF`, `--background #F3F6FF`, `--card #FFFFFF`, `--muted-foreground #4B5478`, `--border #D5DCF0`. `--navy` est redirigé vers l'encre. Success, destructive et accent (ambre, avertissement) sont conservés.
- Ombres : `pop-sm 3px 3px 0`, `pop 4px 4px 0`, `pop-lg 7px 7px 0`, couleur encre. Le X est multiplié par `--pop-x` (1 en LTR, −1 en RTL). Survol : translate(−3px·pop-x, −3px). Clic : translate(2px·pop-x, 2px).
- Contours : Pop = 2px encre ; fin = 1px `--border`. Rayons : tuile 24px, boutons/champs 16px (`rounded-xl`), puces `rounded-full`.
- Polices : titres latins Bricolage Grotesque 800 ; texte latin Sora (ou Poppins, choix à noter dans le compte rendu) ; arabe Readex Pro partout ; Caveat retiré.
- Mouvement : ressort `{ type: 'spring', stiffness: 400, damping: 22 }`. Pas de boucle infinie près des données dans l'admin et les portails. Entrées ≤ 400 ms, contenu jamais bloqué à `opacity: 0`. `prefers-reduced-motion` coupe tout.
- Tout nouveau texte visible est ajouté à `messages/fr.json` ET `messages/ar.json`.
- Contraste AA : 4,5:1 pour le texte normal.
- Commits sur `design/bento-pop`, pushés avec `git -c push.negotiate=true push`.

## Review Focus

1. **Arabe (RTL)** : ombres décalées vers la gauche, survol vers le haut-gauche, barre latérale à droite, Readex Pro partout. C'est vérifié par `scripts/visual-check.mjs` (Task 1, assertions `rtl-*`).
2. **Défilement horizontal sur téléphone (390px)**, sur toutes les pages capturées. Aucun défilement attendu : `visual-check.mjs` vérifie `scrollWidth <= clientWidth`.
3. **Focus clavier** : chaque bouton, lien et champ montre un contour de focus visible sur fond blanc et sur fond bleu. Assertion `focus-visible` dans `visual-check.mjs`.
4. **Formulaires en erreur et désactivés** (`aria-invalid`, `disabled`) : contour rouge lisible et état désactivé distinct. C'est couvert par la page `/login` soumise vide dans `visual-check.mjs`.
5. **Fenêtres Radix centrées en RTL** : le centrage `ltr:/rtl:translate` existant ne doit pas casser avec la nouvelle ombre. Capture d'une fenêtre ouverte en AR (Task 9).

---

## File Structure

| Fichier | Responsabilité |
|---|---|
| `apps/web/src/app/globals.css` | tokens de couleur, `--pop-x`, classes utilitaires `.pop`, `.pop-hover`, règles `[data-surface]` |
| `apps/web/tailwind.config.ts` | expose `ink`, `shadow-pop*`, `rounded-tile`, `font-display` |
| `apps/web/src/app/[locale]/layout.tsx` | chargement des polices (Bricolage, Sora, Readex) |
| `apps/web/src/components/ui/*.tsx` | primitives restylées, API inchangées (+ `Card.variant`) |
| `apps/web/src/components/motion.tsx` | primitives d'animation partagées : `FadeIn`, `StaggerGroup`, `StaggerItem`, `PopHover`, `CountUp`, `SPRING` |
| `apps/web/src/components/{admin,partner,portal,auth}-shell.tsx`, `src/features/public/public-shell.tsx` | cadres + `data-surface` |
| `apps/web/src/components/portal-bottom-nav.tsx` | **nouveau** : barre du bas mobile + panneau « Plus » |
| `apps/web/src/features/public/design-system.tsx` | anciennes briques restylées sur place (même API), nouvelles briques Bento |
| `apps/web/scripts/visual-check.mjs` | **nouveau** : vérifications Playwright et captures |

---

### Task 1: Environnement, base de référence et script de vérification visuelle

**Files:**
- Create: `apps/web/scripts/visual-check.mjs`
- Modify: `apps/web/package.json` (script `"visual-check": "node scripts/visual-check.mjs"`)
- Modify: `.gitignore` (ajouter `apps/web/.visual/`)

**Interfaces:**
- Produces : `node scripts/visual-check.mjs [--base http://localhost:3000] [--shots]`. Le code de sortie vaut 0 si tout passe, 1 sinon. Les captures vont dans `apps/web/.visual/<page>-<locale>-<width>.png`.

- [ ] **Step 1 : Installer et mesurer la base.** `cd apps/web && npm ci && npm run typecheck && npm run build && node scripts/check-i18n.mjs`. Les trois doivent passer avant tout changement. Si l'un échoue déjà, le noter dans le compte rendu sans le corriger.
- [ ] **Step 2 : Démarrer l'API pour les pages authentifiées.** Lancer PostgreSQL 16 local (`/usr/lib/postgresql/16/bin`) ou `docker compose up -d db`, puis `apps/api` : `npm ci`, `.env` à partir de `.env.example` (avec des valeurs locales de test), `npx prisma db push`, `SEED_DEMO=true npm run seed`, `npm run start:dev`. Si l'API ne peut pas démarrer, le script se limite aux pages publiques et de connexion, et le compte rendu le dit.
- [ ] **Step 3 : Écrire `visual-check.mjs`.** Avec Chromium via `require('playwright')`, pour chaque paire (page, locale ∈ {fr, ar}, largeur ∈ {1280, 390}) :
  - Pages : `/`, `/destinations`, `/programs`, `/login`, `/portal/login`, `/partner-portal/login`. Plus, si l'API répond : `/dashboard`, `/candidates`, `/settings`, après connexion avec le compte du seed. Le changement de mot de passe exigé est fait une fois, à la main ou par le script.
  - Assertions (chacune affiche `PASS/FAIL <nom> <page> <locale> <largeur>`) :
    - `no-hscroll` : `document.documentElement.scrollWidth <= clientWidth + 1` ;
    - `ink-token` : `getComputedStyle(root).getPropertyValue('--ink').trim()` non vide ;
    - `surface` : il existe un `[data-surface]` ;
    - `pop-button` : le premier `button` visible de variante primary (sélecteur `[data-variant="primary"]`) a un `box-shadow` dont le premier décalage est `> 0` en fr et `< 0` en ar (assertions `rtl-shadow`) ;
    - `font-ar` : en ar, `getComputedStyle(body).fontFamily` contient `Readex` ;
    - `focus-visible` : après `page.keyboard.press('Tab')`, l'élément actif a un `outline-style` différent de `none` ou un `box-shadow` différent de `none` ;
    - sur `/login` en 1280 fr : soumettre le formulaire vide, puis vérifier qu'au moins un `[aria-invalid="true"]` a une `border-color` différente de celle d'un champ valide.
  - `--shots` enregistre en plus une capture pleine page (`deviceScaleFactor: 1`).
- [ ] **Step 4 : Lancer le script sur le code actuel.** `npm run dev` puis `npm run visual-check`. Attendu : FAIL sur `ink-token`, `surface` et `pop-button` (la preuve que les tests mordent), PASS sur `no-hscroll` (base de référence). Noter tout `no-hscroll` déjà en échec comme dette existante.
- [ ] **Step 5 : Commit.** `git add apps/web/scripts/visual-check.mjs apps/web/package.json .gitignore && git commit -m "chore(web): script de vérification visuelle Playwright"`

### Task 2: Tokens, polices et attribut de surface

**Files:**
- Modify: `apps/web/src/app/globals.css`
- Modify: `apps/web/tailwind.config.ts`
- Modify: `apps/web/src/app/[locale]/layout.tsx`

**Interfaces:**
- Produces (Tailwind) : couleurs `ink`, `primary{DEFAULT,foreground,soft}` (nouvelles valeurs) ; `shadow-pop-sm`, `shadow-pop`, `shadow-pop-lg` ; `rounded-tile` (24px), `rounded-organic` → 24px ; `font-display` ; `border-pop` (largeur 2px).
- Produces (CSS) : `--pop-x` (1, et −1 sous `[dir="rtl"]`) ; classe `.pop` (contour 2px encre + `shadow-pop`) ; `.pop-hover` (transition ressort CSS `cubic-bezier(.3,1.6,.5,1)` 250ms : survol translate + `pop-lg`, actif translate(2px·x,2px) + `pop-sm`) ; `.pop-soft` (contour 1px `--border`, pas d'ombre).
- Produces (layout) : variables `--font-display` (Bricolage Grotesque), `--font-sans` (Sora en fr, Readex en ar). En ar, `--font-display` vaut aussi Readex Pro (700).

- [ ] **Step 1 :** Réécrire le bloc `:root` avec les valeurs des Global Constraints, en HSL comme aujourd'hui. Ajouter `--ink` et `--warning` (= ancienne valeur `--accent`) et garder `--accent` inchangé. `--sw-sky` → nuance de `--primary` à 60 % de luminosité ; `--sw-bg-light` → `--background`.
- [ ] **Step 2 :** Ajouter dans Tailwind les ombres sous la forme `calc(var(--pop-x) * 4px) 4px 0 hsl(var(--ink))` (et de même pour 3px et 7px).
- [ ] **Step 3 :** Remplacer Poppins et Caveat par Bricolage Grotesque (`weight: ['500','800']`) et Sora (`['400','600','700']`) dans `layout.tsx`. Garder `--font-handwritten` pointé vers `--font-display`, pour que `font-handwritten` reste valide jusqu'au lot 2.
- [ ] **Step 4 :** `npm run typecheck && npm run build` passent ; `visual-check` : `ink-token` PASS, `font-ar` PASS.
- [ ] **Step 5 :** Commit `feat(web): tokens Bento Pop (couleurs, ombres RTL, polices)`.

### Task 3: Primitives UI

**Files:**
- Modify: `apps/web/src/components/ui/{button,card,badge,table,form,dialog,confirm-dialog,pagination,skeleton,signature-pad}.tsx`
- Modify: `apps/web/src/components/providers.tsx` (Toaster)

**Interfaces:**
- Consumes : classes `.pop`, `.pop-hover`, `.pop-soft`, `shadow-pop*` (Task 2).
- Produces :
  - `Button` : props inchangées. Ajoute `data-variant={variant ?? 'primary'}` sur le `<button>`. `primary` = bleu + `.pop .pop-hover` + texte blanc gras ; `secondary` = blanc + `.pop .pop-hover` ; `ghost` = sans contour, fond `primary-soft` au survol ; `danger` = destructive + `.pop .pop-hover`. Rayon `rounded-xl`.
  - `Card({ variant?: 'pop' | 'soft', hoverable?, ...div })` : sans `variant`, le style dépend de la surface (`[data-surface=public]` → pop, `[data-surface=app]` → soft) ; `hoverable` ajoute `.pop .pop-hover` partout. Rayon `rounded-tile`. `CardHeader` : titre en `font-display`.
  - `Badge` : `rounded-full`, contour 1.5px encre à 15 % d'opacité, police semi-grasse ; mêmes `tone`.
  - `Table/Th/Td` : contours fins `--border` ; `Th` en majuscules `text-[11px] tracking-wider` ; survol de ligne `bg-primary-soft/50` (via `[&_tbody_tr:hover]` sur `<table>`) ; `tabular-nums`.
  - `Input/Textarea/Select` : `rounded-xl` ; contour 1px en app, 2px encre en public ; focus = contour 2px `primary` + `shadow-pop-sm` teinté primary ; `aria-invalid` = contour destructive 2px.
  - `Dialog` : contenu `.pop` + `shadow-pop-lg`, `rounded-tile`, overlay `bg-ink/40 backdrop-blur-sm`, ouverture avec scale 0.96→1 (classes `data-[state=open]:animate-*` définies dans Tailwind `keyframes`).
  - `Skeleton` : `rounded-xl bg-primary-soft`. `StatCardsSkeleton` et `ListSkeleton` utilisent `rounded-tile`.
  - Toaster sonner : `toastOptions.classNames.toast = 'pop rounded-xl font-sans'`.
- [ ] **Step 1 :** Implémenter dans l'ordre button → card → form → badge → table → dialog/confirm → pagination/skeleton/signature-pad → toaster.
- [ ] **Step 2 :** `npm run typecheck && npm run build` passent.
- [ ] **Step 3 :** `visual-check` : `pop-button` et `rtl-shadow` PASS sur `/login` ; test des champs invalides PASS ; `focus-visible` PASS.
- [ ] **Step 4 :** Commit `feat(web): primitives UI au style Bento Pop`.

### Task 4: Primitives d'animation

**Files:**
- Modify: `apps/web/src/components/motion.tsx`
- Modify: `apps/web/src/features/public/design-system.tsx` (`Reveal*` délèguent à `motion.tsx`)

**Interfaces:**
- Produces :
  - `export const SPRING = { type: 'spring', stiffness: 400, damping: 22 } as const`
  - `FadeIn`, `StaggerGroup`, `StaggerItem` : mêmes props qu'aujourd'hui ; décalage initial `y: 12` → `y: 8` et `opacity: 0.001`, durée ≤ 0,3 s.
  - `PopHover({ children, className, as?: 'div' | 'li' })` : `whileHover={{ y: -3, x: -3 * popX }}`, `whileTap={{ x: 2 * popX, y: 2 }}`, avec `SPRING` ; `popX` lu depuis `document.dir` (−1 si rtl).
  - `CountUp({ value: number, durationMs?: number = 900, format?: (n: number) => string })` : affiche la valeur finale tout de suite si `useReducedMotion()` ; sinon anime de 0 à `value` avec `animate()` de framer-motion. Rend un `<span className="tabular-nums">`.
  - Toutes respectent `useReducedMotion()`, qui renvoie alors directement l'état final.
- [ ] **Step 1 :** Implémenter. Garder les exports `Reveal`, `RevealGroup`, `RevealItem` de `design-system.tsx` avec les mêmes props.
- [ ] **Step 2 :** `typecheck && build` passent.
- [ ] **Step 3 :** Commit `feat(web): primitives d'animation partagées (PopHover, CountUp)`.

### Task 5: Cadres admin et partenaire

**Files:**
- Modify: `apps/web/src/components/admin-shell.tsx`, `apps/web/src/components/partner-shell.tsx`
- Modify: `apps/web/src/components/{page-header,empty-state,notification-bell,command-palette,language-switcher,export-buttons}.tsx`

**Interfaces:**
- Consumes : tokens (Task 2), `Button`/`Card` (Task 3), `SPRING` (Task 4).
- Produces : la racine de chaque cadre porte `data-surface="app"`.

- [ ] **Step 1 : `AdminShell`.**
  - Fond de page `bg-background`. Barre latérale blanche, contour `border-e-2 border-ink` (fin `border-border` sur la carte profil).
  - En-tête de la barre : `StudyWorldLogo` + nom de l'agence en `font-display`.
  - Élément actif : pastille `bg-primary text-white` avec `.pop` (`shadow-pop-sm`) et `rounded-xl`. Les inactifs : survol `bg-primary-soft` avec `translate-x` de 2px (inversé en RTL).
  - La barre du haut garde sa structure ; le déclencheur `CommandPalette` devient un bloc `.pop-soft rounded-xl` avec `Ctrl K` ; la transition de page existante est conservée (≤ 250 ms).
- [ ] **Step 2 : `PartnerShell`.** Même traitement, adapté à sa structure actuelle.
- [ ] **Step 3 : Composants communs.**
  - `PageHeader` : titre `font-display text-3xl font-extrabold tracking-tight`.
  - `EmptyState` : pastille ronde `bg-primary-soft` avec une icône lucide `Inbox` au-dessus du titre (prop optionnelle `icon?: LucideIcon`, `Inbox` par défaut).
  - Cloche, palette, langue, export : contours et rayons alignés sur les primitives.
- [ ] **Step 4 :** `typecheck && build` ; `visual-check` (si l'API tourne) : `surface`, `no-hscroll` et `rtl-*` PASS sur `/dashboard`, `/candidates` et `/settings`.
- [ ] **Step 5 :** Commit `feat(web): cadres admin et partenaire Bento Pop`.

### Task 6: Cadre du portail candidat et barre du bas mobile

**Files:**
- Modify: `apps/web/src/components/portal-shell.tsx`
- Create: `apps/web/src/components/portal-bottom-nav.tsx`
- Modify: `apps/web/messages/fr.json`, `apps/web/messages/ar.json` (clés `portal.more` = « Plus » / « المزيد », `portal.moreTitle` = « Toutes les rubriques » / « كل الأقسام »)

**Interfaces:**
- Consumes : la constante `NAV` de `portal-shell.tsx`, exportée et enrichie d'une icône lucide par entrée : dashboard `House`, profile `UserRound`, documents `FileText`, applications `GraduationCap`, visa `Stamp`, finance `Wallet`, contracts `FileSignature`, appointments `CalendarDays`, messages `MessageCircle`.
- Produces : `PortalBottomNav({ items: PortalNavItem[] })`, avec `type PortalNavItem = { href; labelKey; icon: LucideIcon }`. Entrées fixes : dashboard, documents, messages, appointments, plus un bouton « Plus » qui ouvre un panneau bas (Radix Dialog, `rounded-t-tile .pop`) listant les 5 autres. Le panneau se ferme quand on choisit une rubrique.
- [ ] **Step 1 :** `PortalShell` : racine `data-surface="app"` ; en-tête bloc blanc `.pop-soft rounded-tile` avec logo, nom, langue et déconnexion. Sur `≥ md`, la barre d'onglets actuelle reste, restylée (pastilles actives `.pop`). Sur `< md`, les onglets sont masqués et `PortalBottomNav` s'affiche en bas (`fixed bottom-0`, `padding-bottom: env(safe-area-inset-bottom)`). `main` reçoit `pb-24 md:pb-8` pour ne pas être caché.
- [ ] **Step 2 :** Ajouter les clés i18n ; `node scripts/check-i18n.mjs` passe.
- [ ] **Step 3 :** `typecheck && build` ; vérification manuelle à 390px : les 9 rubriques sont atteignables, l'élément actif est marqué `aria-current="page"` (dans la barre ou dans le panneau), le panneau se ferme avec Échap.
- [ ] **Step 4 :** Commit `feat(web): portail candidat Bento Pop + navigation mobile`.

### Task 7: Cadres public et connexion

**Files:**
- Modify: `apps/web/src/features/public/public-shell.tsx`, `apps/web/src/components/auth-shell.tsx`

**Interfaces:**
- Produces : `PublicShell` racine `data-surface="public"` ; `AuthShell` racine `data-surface="app"`.
- [ ] **Step 1 : `PublicShell`.**
  - L'en-tête devient un bloc flottant `.pop rounded-tile bg-card` dans un conteneur `sticky top-3 mx-auto max-w-6xl`.
  - Sous `md`, la navigation passe dans un menu animé (AnimatePresence, `SPRING`) ouvert par un bouton `Menu`. Libellés `common.close` existants et `nav.openMenu` (réutilisé s'il existe, sinon ajouté aux deux langues).
  - Pied de page : grand bloc `bg-primary text-white rounded-tile .pop` dans le conteneur, à la place de la vague SVG.
  - Bouton WhatsApp : garder sa couleur `#25D366` (couleur de la marque WhatsApp, pas décorative) avec `.pop` ; positionné `end-5` au lieu de `right-5`, pour passer à gauche en RTL.
- [ ] **Step 2 : `AuthShell`.**
  - Le panneau gauche `bg-navy` devient un grand bloc `bg-primary rounded-tile .pop` (marge 16px) avec deux formes `MorphBlob` (Task 8) en fond.
  - Le parcours `journey` est affiché en grandes lignes `font-display`, et les puces deviennent des petits carrés blancs à contour encre.
  - Le formulaire est placé dans un bloc `Card variant="pop"`.
- [ ] **Step 3 :** `typecheck && build` ; `visual-check` sur `/`, `/destinations`, `/programs`, `/login`, `/portal/login` et `/partner-portal/login` : tout PASS, en fr/ar et à 1280/390.
- [ ] **Step 4 :** Commit `feat(web): cadres public et connexion Bento Pop`.

### Task 8: Briques du site public

**Files:**
- Modify: `apps/web/src/features/public/design-system.tsx`

**Interfaces:**
- Produces (nouveau, exporté) :
  - `BentoGrid({ children, className })` : `grid gap-3 sm:grid-cols-2 lg:grid-cols-4`.
  - `BentoTile({ children, className, tone?: 'white' | 'blue' = 'white', span?: 1 | 2 })` : `.pop .pop-hover rounded-tile p-5` ; avec `span=2`, il prend 2 colonnes à partir de `lg`.
  - `StatTile({ value: number; label: string; suffix?: string })` : utilise `CountUp`.
  - `Sticker({ children })` : pastille `.pop rounded-full` légèrement penchée, qui gigote (animation CSS `wiggle` 2,5 s, site public seulement).
  - `Marquee({ items: string[] })` : bandeau défilant, contenu doublé, pause au survol.
  - `MorphBlob({ className })` : forme blanche translucide qui se déforme (animation CSS `morph` 8 s).
- Modifié sur place, **même API** : `StudyWorldButton` (pop bleu), `DestinationCard`/`ServiceCard`/`PostcardCard` (`.pop .pop-hover rounded-tile`, et l'image dans un cadre à contour encre), `FlagBadge`, `JourneyTimeline` (étapes en tuiles numérotées), `TravelSignpost` (puces Pop), `BrushTitle` (le soulignement en pinceau devient un surlignage bleu plat derrière le texte), `HandwrittenTagline` (`font-display`), `PlaneTrail` (trait encre pointillé). `countryAccentColor()` renvoie toujours `hsl(var(--primary))`.
- [ ] **Step 1 :** Ajouter les keyframes `wiggle`, `morph` et `marquee` dans `tailwind.config.ts`, toutes coupées par la règle `prefers-reduced-motion` existante.
- [ ] **Step 2 :** Implémenter les briques et restyler les existantes.
- [ ] **Step 3 :** `typecheck && build` ; `visual-check` sur `/` et `/destinations` : PASS.
- [ ] **Step 4 :** Commit `feat(web): briques Bento du site public`.

### Task 9: Vérification finale, captures et compte rendu

- [ ] **Step 1 :** `npm run typecheck && npm run build && node scripts/check-i18n.mjs` passent.
- [ ] **Step 2 :** `npm run visual-check -- --shots` : tout PASS. Ouvrir à la main une fenêtre (Dialog) en ar sur `/candidates` (création d'un candidat) et en faire une capture.
- [ ] **Step 3 :** Contrôle du contraste : `#2457FF` sur blanc, blanc sur `#2457FF`, `#4B5478` sur `#F3F6FF`. Tous ≥ 4,5:1, calculés par une petite fonction dans le script.
- [ ] **Step 4 :** Rassembler les captures clés (accueil, connexion, tableau de bord, liste des candidats, formulaire, fenêtre, portail mobile ; FR et AR ; ordinateur et téléphone) dans une page de revue publiée comme artefact, pour le propriétaire.
- [ ] **Step 5 :** Push de la branche. Compte rendu : ce qui passe, ce qui n'a pas pu être vérifié (par exemple si l'API n'a pas démarré), le choix Sora ou Poppins, la dette `no-hscroll` préexistante. **Arrêt obligatoire** : le lot 2 attend l'accord du propriétaire.
