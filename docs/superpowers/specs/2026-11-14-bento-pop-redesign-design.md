# Refonte visuelle « Bento Pop » — document de conception

Date : 2026-11-14 · Branche : `design/bento-pop` · Périmètre : `apps/web` uniquement (aucun changement d'API ni de base)

## 1. Intention

Le propriétaire trouve la plateforme actuelle (identité « Premium Travel Editorial ») **trop simple et pas
attirante**. Il veut une image **jeune, vive, professionnelle et très animée**, avec **une seule couleur**
(pas de palette multicolore). Après trois séries de maquettes, il a choisi la direction **Bento Pop** :

- maquettes de référence : https://claude.ai/artifact/EpEkWJVg9cxeWLxaanwdpq (variante **C3 — Bento Pop**)
- blocs « bento » très arrondis assemblés en grille, gros chiffres, typographie massive ;
- **contours foncés épais (2 px) + ombres franches décalées** (`4px 4px 0` couleur encre), façon autocollant ;
- au survol, un bloc « se soulève » : il se décale de −3 px et son ombre grandit à 7 px ; les boutons ont un
  rebond ressort ; petits éléments ludiques (badge qui gigote, formes qui se déforment, logo qui tourne).

Cette refonte est la **première de trois étapes** voulues par le propriétaire : (1) aspect visuel, (2) amélioration
de toutes les fonctionnalités, (3) suggestions pour une plateforme professionnelle. Seule l'étape 1 est couverte ici.

## 2. Décisions du propriétaire

| Sujet | Décision |
|---|---|
| Direction | Bento Pop (C3) |
| Périmètre | **Toute la plateforme** : site public, admin, portail candidat, portail partenaire, pages de connexion |
| Intensité | **Pop complet sur le site public** ; **Pop adouci dans l'admin et les portails** |
| Méthode | **Option 1** : fondations (tokens + composants partagés + 4 cadres) d'abord, puis reprise en profondeur des pages clés |
| Couleur | Une seule couleur de marque (bleu), plus l'encre foncée, le blanc et les couleurs d'état |

### Ce que veut dire « Pop adouci » (admin et portails)

| Élément | Site public | Admin / portails |
|---|---|---|
| Cartes de chiffres clés, tuiles du tableau de bord, cartes cliquables | contour 2 px + ombre 4 px | **idem** (contour 2 px + ombre 4 px) |
| Boutons principaux, badges, puces de statut | Pop complet | **Pop complet** |
| Cartes conteneurs (panneaux, onglets du dossier) | Pop complet | contour **1 px** encre à faible opacité, **pas** d'ombre décalée |
| Tableaux, lignes de liste | — | contours **fins** (1 px, couleur `border`), pas d'ombre, survol = fond bleu très pâle |
| Champs de formulaire | contour 2 px | contour **1 px** ; au focus, contour 2 px bleu + petite ombre 2 px |
| Fenêtres modales | Pop complet | Pop complet (contour 2 px + ombre 6 px) |

Règle générale : **l'ombre décalée est réservée à ce qui est un objet distinct ou cliquable**. Jamais sur chaque
ligne d'un tableau ni sur chaque champ.

## 3. Objectifs, non-objectifs, anti-objectifs

**Objectifs**
- Une identité Bento Pop reconnaissable sur 100 % des écrans, obtenue d'abord en changeant les tokens, les
  composants `components/ui/*` et les cadres de page.
- Les pages à fort impact refaites en profondeur (liste au §6.3).
- Des animations visibles et soignées, mais qui n'empêchent jamais de travailler (§5).
- Rendu correct en **français (gauche→droite)** et en **arabe (droite→gauche)**, sur mobile et sur ordinateur.

**Non-objectifs**
- Aucun changement de fonctionnalité, de logique, d'API, de texte métier ou de permissions (c'est l'étape 2).
- Pas de mode sombre dans cette étape. Les tokens sont toutefois structurés pour l'ajouter plus tard (Bento Nuit).
- Pas de nouveau logo : on garde `study-world-logo.tsx` tel quel (on peut l'encadrer ou l'animer légèrement).
- Pas de bibliothèque d'interface externe (shadcn, MUI…) : on garde `cva` + Radix + Tailwind.

**Anti-objectifs (échec même si « ça marche »)**
- L'admin devient fatigant ou illisible (contours épais partout, animations qui bougent pendant la saisie).
- La version arabe est cassée : glyphes absents, ombres dans le mauvais sens, mise en page non inversée.
- Une animation retarde l'apparition du contenu ou cache des données (contenu laissé en `opacity: 0`).
- Régression fonctionnelle : un bouton, un formulaire ou un dialogue ne marche plus après le changement de style.
- Contraste de texte insuffisant (cible WCAG AA : 4,5:1 pour le texte normal).

## 4. Contraintes techniques constatées

- Next.js 15, React 19, Tailwind **3.4**, next-intl (FR/AR), Framer Motion 11 (déjà installé), lucide-react, sonner.
- Couleurs déjà en variables CSS HSL dans `src/app/globals.css`, exposées dans `tailwind.config.ts`
  (`primary`, `navy`, `muted`, `border`, `success`, `destructive`, `accent`, `sw-sky`…).
- `components/ui/` : `button`, `card`, `badge`, `table`, `form`, `dialog`, `confirm-dialog`, `pagination`,
  `skeleton`, `signature-pad`. Utilisés par 68 fichiers.
- Cadres : `admin-shell.tsx`, `portal-shell.tsx`, `partner-shell.tsx`, `features/public/public-shell.tsx`,
  `auth-shell.tsx`. Animations : `components/motion.tsx` (FadeIn, Stagger) et
  `features/public/design-system.tsx` (Reveal, BrushTitle, DestinationCard, JourneyTimeline…).
- Les pages utilisent aussi beaucoup de classes Tailwind directes (`text-navy` ×74, `rounded-organic` ×24,
  `bg-white` ×24, `border-primary/10` ×20…). Il faut les traiter en remplaçant les valeurs des tokens plutôt que
  page par page, chaque fois que c'est possible.
- Polices actuelles : Poppins (FR), Readex Pro (AR), Caveat (manuscrit FR).
- `globals.css` désactive déjà les animations si l'utilisateur a demandé moins de mouvement : on garde ce comportement.
- Aucun test front-end. Vérification par `npm run typecheck`, `npm run build`, `scripts/check-i18n.mjs` et captures
  d'écran Playwright (Chromium est préinstallé dans l'environnement).

## 5. Système de design Bento Pop

### 5.1 Couleurs (tokens dans `globals.css`)

Une seule couleur de marque. Valeurs reprises de la maquette C3 :

| Token | Valeur | Rôle |
|---|---|---|
| `--ink` | `#0B1230` | encre : texte principal, contours Pop, ombres décalées |
| `--primary` | `#2457FF` | bleu de marque unique (boutons, grand bloc, liens, focus) |
| `--primary-soft` | `#E4EBFF` | fonds de puces, survol de ligne, pistes de progression |
| `--background` | `#F3F6FF` | fond de page (bleu très pâle) |
| `--card` | `#FFFFFF` | blocs |
| `--muted-foreground` | `#4B5478` | texte secondaire |
| `--border` | `#D5DCF0` | contours fins (admin) |
| `--success`, `--destructive`, `--warning` | conservés (vert, rouge, ambre) | **états seulement**, jamais décoratifs |

- `--navy` est redirigé vers `--ink` pour que les 74 `text-navy` existants suivent automatiquement.
- `--sw-sky` et `--accent` ne servent plus de couleur décorative. Ils sont alignés sur une nuance de `--primary`
  pour éviter le multicolore. `--accent` reste utilisable comme couleur d'avertissement si le code l'utilise ainsi :
  le constructeur vérifie chaque usage avant de le changer.
- Les couleurs d'accent par pays (`countryAccentColor`) sont **retirées** au profit du bleu unique.
- Structure prête pour un mode sombre : toutes les couleurs passent par des tokens, aucune couleur codée en dur
  dans les nouveaux composants.

### 5.2 Formes et ombres (tokens Tailwind)

- Rayons : `rounded-tile` = 24 px (blocs), `rounded-xl` = 16 px (boutons, champs), `rounded-full` (puces, avatars).
  `rounded-organic` est redirigé vers 24 px.
- Contours : `border-pop` = 2 px `--ink` ; contour fin = 1 px `--border`.
- Ombres : `shadow-pop-sm` = `3px 3px 0 var(--ink)`, `shadow-pop` = `4px 4px 0`, `shadow-pop-lg` = `7px 7px 0`.
  **En arabe (RTL), le décalage horizontal est inversé** (`-4px 4px 0`), via une variable `--pop-x` qui vaut
  `1` en LTR et `-1` en RTL.
- Survol Pop : `translate(-3px,-3px)` (inversé en RTL) + passage de `shadow-pop` à `shadow-pop-lg`. Clic :
  `translate(2px,2px)` + `shadow-pop-sm`, l'effet de bouton qu'on enfonce.

### 5.3 Typographie

- Titres latins : **Bricolage Grotesque** (800), titres massifs, interlettrage serré (−0,03 em).
- Texte latin : **Sora** (400/600), ou Poppins s'il garde un meilleur rendu dans les tableaux denses. Choix du
  constructeur après comparaison, à noter dans le compte rendu.
- Arabe : **Readex Pro** conservé pour tout le texte arabe (titres en 700). Aucune police latine ne doit
  s'appliquer à l'arabe.
- Caveat (manuscrit) : retiré, car il ne correspond pas à l'esprit Pop.
- Chiffres alignés (`tabular-nums`) dans les tableaux et les cartes de chiffres.
- Chargement via `next/font/google` comme aujourd'hui.

### 5.4 Mouvement (Framer Motion + CSS)

Principe : **beaucoup d'animation sur le site public, de l'animation utile dans l'admin.**

| Contexte | Animations |
|---|---|
| Site public | apparition en cascade des blocs au défilement, formes qui se déforment dans le grand bloc, logo qui tourne doucement, badge « autocollant » qui gigote, compteurs qui défilent jusqu'à leur valeur, bandeau défilant des destinations, ressort au survol des blocs et boutons |
| Admin / portails | entrée en cascade des tuiles du tableau de bord, chiffres clés qui défilent jusqu'à leur valeur à l'arrivée, barres et anneaux de progression qui se remplissent une fois, survol Pop des cartes, transition entre pages (déjà présente, à garder courte), ouverture des fenêtres en ressort, toasts (sonner) stylés Pop |
| Interdit dans l'admin | animations en boucle infinie à côté des données, mouvement pendant la saisie, animation de plus de 400 ms sur une action fréquente |

- Un seul module `components/motion.tsx` regroupe les primitives réutilisables : `FadeIn`, `Stagger`,
  `PopHover`, `CountUp`, `Reveal`. Il fusionne celles de `design-system.tsx` qui ne sont pas propres au site public.
- Ressort par défaut : `type: 'spring', stiffness: 400, damping: 22`.
- Le contenu est **visible au repos** : une animation d'entrée part d'un état visible ou se termine en moins de
  400 ms ; on ne laisse jamais un contenu à `opacity: 0` en attendant le défilement s'il est dans le premier écran.
- `prefers-reduced-motion` : toutes les animations sont coupées (règle CSS existante, plus `useReducedMotion`
  dans les composants Framer).

## 6. Approche retenue et découpage

### 6.1 Approches envisagées

1. **Fondations d'abord, puis pages clés** *(retenue)* : on change les tokens, les composants partagés et les
   4 cadres, ce qui propage le style à toutes les pages, puis on reprend en profondeur les pages à fort impact.
   Avantage : cohérence, risque faible, étapes visibles. Limite : les pages secondaires gardent leur mise en page
   actuelle, seulement restylée.
2. **Refaire chaque page sur mesure** : écartée. Bien plus long, risque d'incohérences et de régressions
   fonctionnelles.
3. **Bibliothèque d'interface toute faite** : écartée. Elle donnerait un look standard, l'inverse de l'objectif, et
   doublerait la base `cva`/Radix existante.

### 6.2 Lot 1 — Fondations (touche toutes les pages)

1. Tokens : `globals.css` + `tailwind.config.ts` (couleurs, rayons, ombres Pop avec inversion RTL, polices).
2. Composants `components/ui/*` restylés **sans changer leur API** (mêmes props, mêmes variantes) :
   - `Button` : variantes `primary` (bleu, contour encre, ombre Pop, effet enfoncé), `secondary` (blanc, contour
     encre), `ghost`, `danger` ; tailles inchangées.
   - `Card` : nouvelle prop optionnelle `variant: 'pop' | 'soft'` (défaut `soft` dans l'admin, `pop` quand
     `hoverable`) ; `CardHeader` avec titre en police d'affichage.
   - `Badge` : puces arrondies à contour 1,5 px encre ; mêmes tons.
   - `Table`/`Th`/`Td` : version adoucie (contours fins, en-tête en majuscules espacées, survol bleu pâle).
   - `form` (inputs, select, textarea, labels, erreurs) : contour 1 px, focus 2 px bleu + petite ombre Pop.
   - `Dialog`/`ConfirmDialog` : Pop complet, ouverture en ressort.
   - `Pagination`, `Skeleton` (blocs arrondis bleu pâle qui pulsent), `SignaturePad` (cadre Pop).
   - `Toaster` sonner : style Pop.
3. Cadres :
   - `AdminShell` : barre latérale blanche, élément actif = pastille bleue avec contour encre et ombre Pop
     (survol avec légère translation), carte profil en bas ; en-tête avec recherche `Ctrl K` en forme de bloc.
   - `PortalShell` (candidat) : **pensé mobile d'abord**, avec une barre de navigation en bas sur téléphone
     (icônes + libellés), en-tête « Salut {prénom} ».
   - `PartnerShell` : même logique que l'admin, plus simple.
   - `PublicShell` : barre de navigation en bloc Pop flottant, menu mobile animé, pied de page en grand bloc bleu.
   - `AuthShell` (toutes les pages de connexion, mot de passe oublié, activation) : écran en bento, avec le
     formulaire dans un bloc Pop et un grand bloc bleu décoratif animé.
4. `components/empty-state.tsx`, `page-header.tsx`, `notification-bell.tsx`, `command-palette.tsx`,
   `language-switcher.tsx`, `export-buttons.tsx` : restylés.
5. Retirer ou adapter dans `design-system.tsx` ce qui porte l'ancienne identité (`BrushTitle`,
   `HandwrittenTagline`, `PlaneTrail`, `PostcardCard`, `TravelSignpost`, `countryAccentColor`) et le remplacer
   par des briques Bento (`BentoGrid`, `BentoTile`, `StatTile`, `Sticker`, `Marquee`, `MorphBlob`).

### 6.3 Lot 2 — Pages reprises en profondeur

Par ordre de priorité :
1. **Accueil public** (`public-landing-page.tsx`) : grille bento comme la maquette C3, avec le grand bloc d'accroche,
   le bloc des 5 destinations, le bloc « ils sont déjà partis », le parcours animé, les services, la section
   simulateur, le formulaire de contact en bloc Pop. Les vraies images des destinations restent utilisées dans
   des blocs à contour Pop.
2. **Pages publiques** : destinations (liste + détail), universités, programmes (recherche, détail, comparateur),
   simulateur d'éligibilité, blog (liste + article).
3. **Tableau de bord admin** (`dashboard-page.tsx`, `deadlines-widget.tsx`) et **Command Center** : tuiles bento,
   chiffres qui défilent, graphiques et barres animés.
4. **Dossier candidat** (`candidate-detail-page.tsx` + onglets + `health-score-card.tsx`) : en-tête bento (identité,
   statut, score santé en anneau), onglets en pastilles.
5. **Portail candidat** : tableau de bord mobile comme la maquette (anneau de complétude du dossier, parcours
   Admission → Visa → Départ, prochain rendez-vous, reste à payer, bouton « Déposer un document »), puis les
   autres pages du portail.
6. **Prospects Kanban** (`prospects-board.tsx`) : colonnes et cartes Pop, glisser-déposer avec un petit penché
   pendant le déplacement.
7. **Portail partenaire** : tableau de bord en tuiles.

Les autres pages admin (rôles, branches, employés, paramètres, journaux, caisse, dépenses, rapports,
automatisations, blog-admin, site-admin, platform-admin, catalogue, tâches, rendez-vous, compte) reçoivent le
nouveau style via le lot 1. On n'y fait que des retouches ponctuelles si une classe codée en dur casse le rendu.

### 6.4 Livraison

- Tout sur la branche `design/bento-pop`, un commit par étape logique, poussé régulièrement.
- À la fin de chaque lot, des captures d'écran (FR et AR, ordinateur et téléphone) sont montrées au propriétaire
  pour validation avant de continuer.
- Pull request ouverte seulement quand le propriétaire le demande.

## 7. Vérification

- `npm run typecheck` et `npm run build` passent dans `apps/web`.
- `node scripts/check-i18n.mjs` passe. Tout nouveau texte visible est ajouté à `messages/fr.json` **et** `ar.json`.
- Captures Playwright des pages des lots 1 et 2, en FR et en AR, à 1280 px et 390 px. On vérifie l'absence de
  défilement horizontal, le sens RTL, la direction des ombres et la lisibilité.
- Contraste AA vérifié pour : texte sur fond, texte blanc sur bleu `#2457FF`, texte secondaire.
- Navigation au clavier : focus visible sur tous les éléments interactifs, y compris le nouveau style de focus Pop.
- Sans base de données ni API, les pages qui en dépendent sont vérifiées avec l'API lancée en local (PostgreSQL
  via Docker, seed de démonstration) si l'environnement le permet. Sinon, le constructeur le signale.

## 8. Précisions après relecture (choix de conception, à valider par le propriétaire)

1. **Widgets du portail candidat** : autorisés, à condition de n'utiliser que des **routes API existantes**, sans
   aucune modification du backend. Le « reste à payer » vient de `/portal/invoices` (déjà appelé par la page
   finance), en additionnant le solde des factures non payées. La complétude du dossier = éléments de checklist
   faits ou non applicables / total. Le parcours Admission → Visa → Départ suit le statut de la candidature la plus
   avancée et du dossier visa, selon une table de correspondance écrite dans le plan. Le texte d'accueil existant
   (`welcome`) est conservé ; aucun texte métier n'est réécrit.
2. **Barre du bas du portail sur téléphone** : 4 entrées (Accueil, Documents, Messages, Rendez-vous) et un bouton
   « Plus » qui ouvre un panneau avec les 5 autres sections. Toutes les sections restent accessibles. Sur ordinateur,
   la navigation complète est gardée, restylée.
3. **Comment `Card` sait où il est** : chaque cadre pose un attribut `data-surface="public"` ou `data-surface="app"`
   (admin, portails, connexion). Le style par défaut des cartes en dépend par CSS : Pop complet sur `public`,
   adouci sur `app`. Aucune modification des 68 fichiers n'est nécessaire. La prop `variant` permet de forcer un
   style au cas par cas, par exemple les tuiles de chiffres en `pop` dans l'admin.
4. **Les portails suivent les règles d'animation de l'admin** (§5.4) : pas de boucle infinie près des données. Les
   anneaux et barres se remplissent une seule fois. Seule exception : un point qui pulse doucement sur l'étape en
   cours du parcours.
5. **Validation entre lots = arrêt obligatoire** : le plan s'arrête après le lot 1 avec des captures d'écran. Le
   lot 2 ne commence qu'après l'accord du propriétaire.
6. **Référence pour l'admin** : il n'y a pas de maquette admin en C3. Le style adouci est défini par le §2 et le
   §6.2, et les captures du lot 1 (tableau de bord, liste des candidats, un formulaire, une fenêtre) servent de
   référence validée par le propriétaire.
7. Il y a **cinq** cadres (admin, portail, partenaire, public, connexion), pas quatre.

## 9. Laissé au constructeur

- Les valeurs exactes de ressort et de durée, dans les limites du §5.4.
- Le choix entre Sora et Poppins pour le texte courant (§5.3).
- La structure interne des nouvelles briques Bento et le nom des fichiers.
- La manière de traiter chaque classe Tailwind codée en dur qui ne suit pas les tokens.
- Les icônes lucide à utiliser dans la nouvelle navigation mobile du portail.
