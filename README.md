# Study in World — Plateforme de gestion

Monorepo : `apps/api` (NestJS + Prisma + PostgreSQL) et `apps/web` (Next.js 15, React 19, Tailwind, next-intl).
Interface en **français et arabe (RTL)**. Une seule agence au lancement (Gabès), mais chaque table porte déjà un
`organizationId` : passer plus tard à plusieurs agences ne demandera pas de refonte.

Cette livraison couvre les phases 1 à 7 du cahier des charges (sur 12 au total — voir la section « Écart avec le
cahier des charges complet » ci-dessous) : authentification et RBAC, CRM (prospects/candidats), dossier candidat
(documents, checklist), catalogue (pays/universités/programmes/recherche/comparateur), candidatures et visas,
finance (devis, factures, paiements, caisse, dépenses), tâches et rendez-vous, et un site public avec page
d'accueil, destinations, universités, programmes et formulaire de contact.

## Fonctionnalités livrées

| Domaine | Fonctionnement |
|---|---|
| Authentification | Connexion e-mail + mot de passe (argon2), jeton d'accès 15 min, refresh token à rotation stocké haché en cookie httpOnly, détection de rejeu, verrouillage après 5 échecs (15 min), mot de passe oublié par e-mail, changement de mot de passe, journal des connexions |
| Rôles et permissions | Permissions au format `module.action`, 9 rôles initiaux, rôles personnalisés, matrice de permissions modifiable, protection contre l'escalade de privilèges, Super Admin inaltérable |
| Employés · Branches · Paramètres | CRUD complet, suppression logique, mot de passe provisoire, paramètres d'agence (nom, logos, coordonnées, devise) avec sous-ensemble public |
| **CRM — Prospects** | Création avec détection de doublon (téléphone, contre prospects *et* candidats), passage en force assumé, sources, notes horodatées, conversion en candidat (transactionnelle, traçée). Vue Kanban avec glisser-déposer entre statuts, scoring /100 (chaud/tiède/froid) aidant à prioriser, ville/destination/budget/campagne, relances programmées visibles sur le tableau de bord |
| **CRM — Candidats** | Dossier complet par candidat, chronologie unifiée (notes, appels, changements de statut, documents), assignation à un conseiller |
| **Dossier candidat — Documents** | Upload local (PDF/JPEG/PNG/WEBP, 15 Mo max), versionné par type, revue (approuvé/rejeté), téléchargement authentifié, suppression logique |
| **Dossier candidat — Checklist** | Éléments réordonnables, cycle de statut (à faire / fait / non applicable) |
| **Candidatures et visas** | Suivi par université/programme/session avec statuts, dossiers visa liés ou non à une candidature, rendez-vous d'ambassade. Chaque dossier visa a sa **checklist pré-remplie** (formulaire, passeport, assurance, logement, preuve financière…) avec centre de visa, numéro de référence et date de dépôt ; le candidat voit sa progression en lecture seule dans son portail |
| **Catalogue** | Pays, universités, programmes avec fiches riches (avantages, coût de vie, conditions d'admission, visa…), recherche filtrée (pays/ville/niveau/domaine/langue/budget/IELTS), comparateur (4 programmes), pages publiques dédiées (destinations, universités, programmes) ; une candidature peut pointer vers un programme réel du catalogue ou rester en saisie libre |
| **Automatisations** | Règles « quand… alors… » configurables sans code (`/automation`) : changement de statut candidature/visa ou document rejeté → création de tâche, ajout d'élément de checklist, note de chronologie. Historique d'exécution consultable |
| **Portail candidat** | Espace personnel (`/portal`) avec authentification totalement séparée de celle des employés : le candidat consulte son profil, ses documents (et peut déposer les siens), ses candidatures, son visa, ses factures/paiements et ses rendez-vous. Invitation déclenchée par un employé depuis le dossier candidat (lien d'activation par e-mail) |
| **Messagerie candidat ↔ agence** | Fil de discussion par candidat, visible des deux côtés (dossier candidat pour l'employé, onglet « Messages » pour le candidat), statut lu/non lu suivi séparément pour chaque côté |
| **Lien WhatsApp direct** | Bouton WhatsApp sur les prospects et candidats (ouvre `wa.me` avec le numéro, sans API ni dépendance externe — conforme à la consigne du cahier des charges de ne jamais bloquer sur une intégration externe) |
| **Échéances centralisées** | Widget de tableau de bord agrégeant candidatures, visas, tâches, rendez-vous et factures sur 30 jours, classés par urgence (retard/aujourd'hui/bientôt/à venir), filtré selon les permissions de l'utilisateur |
| **Finance** | Devis → contrat → facture (conversion tracée à chaque étape), lignes libres, paiements multi-moyens (espèces/virement/carte/chèque), solde et statut de facture recalculés automatiquement, numérotation séquentielle par agence/année, PDF devis/facture/reçu/contrat |
| **Contrats et signature électronique** | Contrat généré depuis un devis accepté (modèle configurable dans Paramètres, avec espaces réservés), signature au tracé (souris/tactile, aucune bibliothèque externe) en présentiel ou à distance via le portail candidat. Un contrat signé devient définitivement figé — plus aucune modification possible, seule l'annulation reste ouverte |
| **Rentabilité et prévisions financières** | Dans le dossier candidat : revenus (paiements reçus) moins dépenses attribuées = marge, avec possibilité d'attribuer une dépense à un candidat précis. Page `/reports` : encaissé / à encaisser / impayés en retard / dépenses et flux de trésorerie net, sur 5 périodes (7 jours à 12 mois) |
| **Health Score** | Score /100 recalculé à la demande sur chaque dossier candidat : profil incomplet, document manquant/rejeté/expiré ou bientôt expiré, candidature sans date limite respectée, rendez-vous visa dépassé, facture en retard, tâche en retard — chaque problème est listé avec sa gravité (critique/important/attention), jamais une décision automatique |
| **Command Center** | Page `/command-center` (nouvelle permission `command_center.view`, accordée au Directeur) : Aujourd'hui (nouveaux prospects, rendez-vous, documents à vérifier, encaissé, tâches), Risques (candidats à risque avec leurs raisons, agrégés par requêtes groupées — jamais une boucle candidat par candidat), Finance, Admissions et Visa par statut |
| **Partenaires et portail partenaire** | Gestion des partenaires (`/partners` : universités, écoles, agents…) avec modèle de commission (fixe ou pourcentage), lien candidat ↔ partenaire, commissions suivies par statut (à confirmer → attendue → facturée → reçue). **Troisième système d'authentification indépendant** pour le portail partenaire : isolation stricte (un partenaire ne voit que ses propres candidats référés), lecture + commentaire uniquement — jamais de modification directe du statut d'une candidature ni d'accès aux documents/finances internes |
| **Caisse** | Une session ouverte par branche à la fois, mouvements IN/OUT liés aux paiements en espèces et aux dépenses, clôture avec calcul de l'écart |
| **Dépenses** | Toujours réglées en espèces depuis la caisse ouverte de la branche |
| **Tâches et rendez-vous** | Assignation, priorité, échéance, vue "les miennes / toutes", agenda simple |
| **Site public** | Page vitrine (à la racine du domaine) avec formulaire de contact → crée un prospect `WEBSITE`, sans jamais bloquer sur un doublon. **Simulateur d'éligibilité** (`/eligibility`) : destination, niveau, budget, score IELTS → programmes du catalogue qui correspondent, avec capture du lead enrichie (destination, budget, campagne « simulateur-eligibilite ») pour le suivi CRM |
| **Assistant IA** (optionnel) | Résumé du dossier candidat en un clic (profil, Health Score, candidatures, visa, derniers événements) et brouillon de message généré à partir d'une instruction courte, toujours relu et modifiable avant envoi — jamais écrit ni envoyé automatiquement. Nécessite `ANTHROPIC_API_KEY` : sans clé, un message clair l'indique plutôt que d'échouer silencieusement |
| **OCR passeport** (gratuit, hors ligne) | Lecture automatique de la zone MRZ du passeport (Tesseract.js + décodage ICAO 9303 réimplémenté maison) sur les documents de type Passeport déjà déposés. Chaque champ affiche sa propre somme de contrôle officielle ; l'employé applique lui-même, champ par champ, ce qu'il juge fiable — jamais de saisie automatique. Précision dépendante de la qualité de la photo, assumée dès le départ |
| **SEO du site public** | Chaque page publique (accueil, destinations, universités, programmes, simulateur) a son propre titre, sa description et repasse explicitement en indexable — le reste de l'application (admin, portails) reste `noindex` par défaut. Données structurées schema.org (Organisation sur l'accueil, programme d'études sur chaque fiche programme). `sitemap.xml` et `robots.txt` générés dynamiquement à partir du catalogue réel (pays, universités, programmes), en FR et AR |
| **Identité visuelle « Premium Travel Editorial »** | Refonte du site public (page d'accueil) sur l'identité de marque fournie (palette bleu marine/royal/ciel, logo recomposé, Poppins pour le français, touches manuscrites pour les slogans) et les vraies affiches de l'agence : bannières Brésil/Malte/Albanie/Hongrie/Lituanie réutilisées directement comme visuels de destination. Composants réutilisables (`BrushTitle`, `DestinationCard`, `JourneyTimeline`, etc.) prêts à être appliqués aux pages restantes |
| **Animations** (Framer Motion) | Apparition progressive des sections au défilement sur le site public, cartes qui se soulèvent au survol (effet ressort), menu mobile animé, transition douce entre les pages admin et portail. Cartes cliquables (`Card hoverable`) et boutons harmonisés dans toute l'application — un seul composant à ajuster pour changer partout |
| **Squelettes de chargement** | Blocs qui pulsent doucement (`Skeleton`, `TableSkeleton`, `StatCardsSkeleton`, `ListSkeleton`) à la place du texte « Chargement... », sur les pages les plus consultées |
| **Recherche globale** (`Ctrl+K` / `Cmd+K`) | Cherche parmi les candidats et les prospects en même temps, groupés par type, depuis n'importe quelle page admin |
| **Blog** | Rédaction et publication depuis `/blog-admin` (permissions `blog.view`/`blog.manage`), page publique `/blog` et `/blog/[slug]` avec la même identité que le reste du site public, SEO propre à chaque article. 3 articles d'exemple (conseils génériques et vrais, aucune donnée inventée sur l'agence) livrés avec le seed, à modifier ou remplacer directement depuis l'interface |
| **SaaS multi-agences** (`/platform-admin`) | Créer une nouvelle agence cliente complète (organisation, paramètres, branche, rôle Super Admin, premier compte) en un clic, suivre sa formule (Essai/Starter/Pro/Entreprise) et le statut de son abonnement. **Facturation manuelle** par agence (aucun prestataire de paiement, comme demandé) : ajouter une facture, suivre son échéance, la marquer payée. Réservé à `isPlatformAdmin`, un indicateur séparé du système de permissions normal et jamais réglable depuis l'écran de gestion des employés — voir la section dédiée plus bas |
| **Export Excel/PDF** | Sur les listes de candidats, de prospects et sur les prévisions financières — même filtre que ce que vous voyez à l'écran, jusqu'à 5 000 lignes |
| **Notifications** (interrogation régulière, pas de WebSocket) | Cloche avec badge dans l'en-tête admin : un candidat envoie un message → son conseiller assigné est notifié ; une tâche est assignée à quelqu'un d'autre que soi-même → cette personne est notifiée. Volontairement limité à ces deux cas — trop de notifications rend la cloche aussi inutile que pas de notification du tout |
| Journal d'audit | Actions sensibles + connexions, consultable dans l'interface. Aucun mot de passe n'y est jamais écrit |

## Démarrage

Prérequis : Node 22+, Docker (pour PostgreSQL).

```bash
cp .env.example .env
# Éditer .env : POSTGRES_PASSWORD, JWT_SECRET (openssl rand -base64 48), SEED_ADMIN_EMAIL / SEED_ADMIN_PASSWORD
# et mettre le même mot de passe dans DATABASE_URL.

docker compose up -d db

cd apps/api
npm install
cp ../../.env .env
npx prisma migrate dev --name init     # crée et applique la migration initiale (à committer)
npm run seed                           # organisation, branche Gabès, permissions, rôles, Super Admin
npm run start:dev                      # API : http://localhost:4000/api  (Swagger : /api/docs en dev)

cd ../web
npm install
echo "NEXT_PUBLIC_API_URL=http://localhost:4000/api" > .env.local
npm run dev                            # http://localhost:3000
```

Connexion avec `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD` : le changement de mot de passe est exigé immédiatement.
`SEED_DEMO=true` crée en plus quelques employés `@demo.local` (interdit en production).

**Tout en Docker** (première fois, avant que la migration initiale existe) :
`ALLOW_DB_PUSH=true docker compose up --build`, puis `docker compose exec api npx ts-node prisma/seed.ts`.
Dès que `apps/api/prisma/migrations/` est committé, le conteneur applique `prisma migrate deploy` et `ALLOW_DB_PUSH` n'est plus nécessaire.

Les documents candidats sont stockés sur disque, hors de tout dossier public (`STORAGE_DIR`, par défaut
`apps/api/storage/documents`). Pensez à inclure ce dossier dans vos sauvegardes.

## Tests

```bash
cd apps/api && npm test            # 170 tests : guard de permissions, auth employé, auth portail candidat et
                                    # auth portail partenaire (verrouillage, invitation, jetons distincts par
                                    # portail), employés, prospects (dédoublonnage, conversion, calcul du
                                    # score de lead), finance (paiements, solde, caisse), caisse (session
                                    # unique, calcul de solde), catalogue (recherche filtrée, slugs uniques),
                                    # lien candidature ↔ catalogue, moteur d'automatisation (déclenchement,
                                    # échec partiel, journal), agrégateur d'échéances (filtrage par
                                    # permission, relances prospects), messagerie (statut lu/non lu par
                                    # côté), checklist visa (pré-remplissage, isolation candidat/dossier
                                    # visa), contrats (création depuis un devis, verrouillage après
                                    # signature), rentabilité et prévisions financières (calcul de marge,
                                    # flux de trésorerie net), Health Score (score plafonné à 0-100, tri par
                                    # gravité), Command Center (agrégation par candidat, limite à 10),
                                    # partenaires et commissions (dérivation stricte du partenaire, isolation
                                    # du portail partenaire testée explicitement), capture de lead publique
                                    # (agence introuvable ignorée en silence, pays d'une autre organisation
                                    # rejeté sans faire échouer la création), assistant IA (refuse clairement
                                    # sans clé configurée, erreurs réseau/API gérées, jamais d'échec
                                    # silencieux), validation du partenaire lié à un candidat (audit de
                                    # sécurité), OCR (décodage MRZ vérifié contre le vecteur de test officiel
                                    # ICAO 9303, rejet propre des PDF), blog (slug unique par agence,
                                    # publication qui fixe la date, isolation stricte), gestion des agences
                                    # côté plateforme (scaffoldage complet d'une nouvelle agence, e-mail déjà
                                    # pris refusé, garde testé explicitement contre un contournement par un
                                    # Super Admin d'agence, facturation manuelle avec calcul de « en retard »
                                    # à la lecture — voir la section SaaS plus bas), export Excel/PDF (signature
                                    # de fichier réelle vérifiée, pas seulement la compilation), notifications
                                    # (ne notifie jamais quand on s'assigne quelque chose à soi-même), câblage
                                    # HTTP de tous les modules
cd apps/web && npm run typecheck && npm run check:i18n && npm run build
```

### Tester le portail candidat sans configurer de SMTP

Sans `SMTP_HOST` renseigné, l'API n'échoue jamais l'envoi d'un e-mail : elle **écrit le contenu (lien inclus) dans
les logs du terminal où tourne `npm run start:dev`**. Pour essayer le portail de bout en bout en local :

1. Créez un candidat avec une adresse e-mail, puis cliquez **Inviter au portail** dans son dossier.
2. Dans le terminal de l'API, repérez la ligne `SMTP non configuré — e-mail non envoyé à … / http://localhost:3000/fr/portal/activate?token=…`.
3. Ouvrez ce lien dans le navigateur, choisissez un mot de passe.
4. Connectez-vous sur `http://localhost:3000/fr/portal/login`.

## Décisions à connaître

- **Employé = utilisateur** : une seule table `User` (au lieu de `User` + `Employee`).
- **Isolation multi-agences** : `organizationId` filtré explicitement dans chaque service (et couvert par des tests).
- **Refresh token** en cookie httpOnly (`SameSite=Lax`, chemin `/api/auth`). En production, servez le web et l'API sous le
  même domaine (ex. `/api` derrière Nginx) et mettez `NODE_ENV=production` pour activer `Secure`.
- **Droits rechargés à chaque requête** : désactiver un employé ou changer son rôle prend effet immédiatement.
- **Dédoublonnage des prospects** : vérifie le téléphone contre les prospects *et* les candidats existants ; l'utilisateur
  peut toujours forcer la création (`force: true`) après avoir vu l'avertissement — un choix humain, jamais bloquant.
- **Le score de lead (/100) est un indicateur, jamais une décision automatique** : calculé à partir de champs simples
  (budget renseigné, destination choisie, e-mail présent, conseiller assigné, statut, relance en retard ou non) —
  volontairement sans compter les appels/messages échangés pour l'instant (aurait demandé une requête coûteuse sur
  toute la chronologie à chaque affichage de la liste). Aucun prospect n'est jamais converti ou écarté automatiquement
  sur la base de ce score.
- **La caisse suit la branche, pas l'utilisateur** : une seule session ouverte par branche. Un paiement en espèces ou une
  dépense exige qu'un employé de cette branche ait ouvert la caisse au préalable ; sinon l'opération est refusée avec un
  message explicite plutôt que de créer un mouvement fantôme.
- **Les dépenses sont toujours en espèces** (Phase 5 volontairement simple) : chaque dépense crée un mouvement de caisse
  sortant. Un mode "dépense par virement" (sans toucher la caisse) est une extension facile si le besoin apparaît.
- **Le portail candidat a son propre système d'authentification**, entièrement séparé de celui des employés (jetons,
  cookies, tables en base toutes distinctes) : un incident de sécurité sur l'un ne peut techniquement pas affecter
  l'autre. Un candidat n'a accès qu'à ses propres données — il n'y a même pas de paramètre d'URL à falsifier, tout
  est dérivé de son jeton de session.
- **La chronologie visible par le candidat exclut les notes internes** (type `NOTE`) : seuls les événements
  automatiques (changement de statut, document, système) apparaissent dans son portail, pour ne jamais exposer une
  remarque destinée uniquement à l'équipe.
- **Une seule conversation par candidat** (pas de fils multiples ni de pièces jointes dans les messages pour
  l'instant) : c'est la version simple de la section 52, suffisante pour un usage quotidien. Les pièces à échanger
  passent par l'onglet Documents, déjà bidirectionnel.
- **Signature électronique au tracé uniquement** (souris ou tactile) — pas de signature par OTP e-mail pour
  l'instant. Le tracé fonctionne aussi bien en présentiel (le candidat signe sur l'écran de l'employé) qu'à
  distance (le candidat signe depuis son propre appareil, via le portail) : un seul composant, deux contextes.
  Un contrat signé est définitivement figé — plus aucune modification, seule l'annulation reste possible, jamais
  une réécriture d'un document déjà signé.
- **Le Health Score est recalculé à la demande, jamais stocké** : les données sous-jacentes (documents, factures,
  tâches, rendez-vous) changent trop souvent pour qu'un score en base reste fiable. Chaque problème détecté a une
  gravité (critique/important/attention) et une pénalité fixe ; le score n'est qu'un indicateur pour le
  conseiller, il ne bloque et ne déclenche jamais rien automatiquement.
- **Le Command Center n'appelle jamais le Health Score candidat par candidat** — ça aurait été correct mais bien
  trop lent avec plusieurs centaines de dossiers (une boucle avec plusieurs requêtes par candidat). À la place,
  il agrège directement par requêtes groupées (factures en retard, documents qui expirent, etc.) puis assemble
  les résultats par candidat en mémoire. Le compromis : les critères de risque du Command Center sont volontairement
  plus simples que ceux du Health Score détaillé (pas de vérification du profil incomplet, par exemple).
- **Le portail partenaire est volontairement limité à la lecture et au commentaire** — le cahier des charges
  envisageait qu'un partenaire puisse modifier le statut d'une candidature ou envoyer une admission directement,
  mais laisser un acteur externe modifier des données internes sans passage par un employé est un risque
  d'intégrité qu'on préfère ne pas prendre à ce stade. Le partenaire voit ses candidats référés (isolation stricte,
  testée explicitement), leur progression, et peut laisser un commentaire — jamais leurs documents ni les détails
  financiers internes. L'équipe garde le contrôle de toute décision.
- **La commission est toujours dérivée du candidat (`candidate.partnerId`), jamais choisie librement à la
  création** — ça évite d'attribuer par erreur une commission au mauvais partenaire. Un candidat doit d'abord
  être lié à un partenaire avant qu'une commission puisse être créée pour lui.
- **Le simulateur d'éligibilité n'a nécessité presque aucun nouveau code backend** — il réutilise directement
  la recherche de programmes déjà publique (`/public/catalog/programs`, avec ses filtres pays/niveau/budget/IELTS
  déjà construits en Phase 4) plutôt que d'inventer une logique de correspondance séparée. Le seul ajout réel :
  la capture de lead publique accepte maintenant les réponses du simulateur (destination, budget, campagne),
  avec une vérification systématique que l'ID de pays envoyé appartient bien à cette agence avant de l'utiliser
  — un visiteur du site n'est jamais authentifié, donc jamais présumé de bonne foi sur les identifiants qu'il envoie.
- **L'assistant IA est optionnel, sur le même principe que le SMTP** : sans `ANTHROPIC_API_KEY` configurée, un
  message clair l'indique plutôt que d'échouer silencieusement. Il n'écrit jamais rien en base et n'envoie jamais
  rien lui-même — le résumé s'affiche en lecture, le brouillon de message remplit juste la zone de texte que
  l'employé doit encore relire et valider avant envoi. Le prompt ne contient que des faits réels tirés de la base
  (profil, Health Score, candidatures, visa) : l'IA ne reçoit jamais un accès direct à la base de données.
- **Le sitemap et le `robots.txt` existaient déjà mais ne servaient à rien** : chaque page héritait du réglage
  `noindex` du layout racine (nécessaire pour l'admin et les portails) sans qu'aucune page publique ne le
  repasse explicitement à `index`. Autrement dit, même listée dans le sitemap, une page restait invisible des
  moteurs de recherche. C'est corrigé : chaque page publique déclare maintenant ses propres métadonnées
  (titre, description, `index: true`, liens alternates FR/AR). Aucune donnée inventée dans le JSON-LD — l'adresse
  et le téléphone affichés dans le pied de page restent des valeurs à personnaliser, ils ne figurent donc pas
  dans les données structurées tant qu'ils ne sont pas réels.
- **Le pied de page public affichait un numéro et une adresse codés en dur** alors que l'API renvoyait déjà les
  vraies coordonnées de l'agence (téléphone, e-mail, adresse depuis Paramètres) — le type frontend `PublicAgency`
  les ignorait simplement. C'est corrigé : le pied de page et les données structurées utilisent maintenant les
  vraies coordonnées si elles sont renseignées, et n'affichent rien du tout sinon (jamais un placeholder qui
  ressemble à une vraie information).
- **Audit de l'isolation multi-agence** : passage systématique sur les modules les plus récents (partenaires,
  portail partenaire, Command Center, assistant IA) pour vérifier que chaque requête filtre bien par
  `organizationId`. Deux points corrigés par précaution — `PortalService.profile()` et
  `PartnerPortalService.profile()` ne filtraient pas explicitement par organisation (le jeton JWT garantissait
  déjà cette appartenance en amont, donc rien n'était réellement exploitable, mais le principe reste : chaque
  requête doit être sûre par elle-même, sans dépendre de ce qu'une autre couche a déjà vérifié). Un vrai manque
  corrigé au passage : lier un candidat à un partenaire acceptait n'importe quel identifiant sans vérifier qu'il
  appartient à l'agence — désormais rejeté proprement plutôt que de risquer une erreur de contrainte brute.
- **L'OCR n'utilise pas le paquet npm `mrz`** malgré son nom bien trouvé : il n'est distribué qu'en ESM pur,
  incompatible avec la configuration CommonJS de ce projet (et de Jest). L'algorithme de décodage MRZ (norme
  ICAO 9303, format passeport TD3) est réimplémenté directement — assez court et entièrement documenté
  publiquement pour que ce soit le choix le plus robuste plutôt que de lutter contre l'outillage. Vérifié
  contre le vecteur de test officiel de la norme, pas seulement des cas inventés.
- **Les données d'entraînement Tesseract sont livrées avec le projet** (`apps/api/tessdata/`, ~2 Mo) plutôt que
  téléchargées au premier lancement : l'OCR fonctionne entièrement hors ligne, y compris sur une machine sans
  connexion internet stable, cohérent avec l'installation locale déjà documentée pour le reste de l'application.
- **Signature électronique au tracé uniquement** (souris ou tactile) — pas de signature par OTP e-mail pour
  l'instant. Le tracé fonctionne aussi bien en présentiel (le candidat signe sur l'écran de l'employé) qu'à
  distance (le candidat signe depuis son propre appareil, via le portail) : un seul composant, deux contextes.
  Un contrat signé est définitivement figé — plus aucune modification, seule l'annulation reste possible, jamais
  une réécriture d'un document déjà signé.
- **PDF en français uniquement pour l'instant** — voir la suggestion dédiée ci-dessous, c'est un choix délibéré plutôt
  qu'un rendu arabe approximatif.
- **Permissions des rôles opérationnels et déjà-seedés** : si vous avez déjà exécuté `npm run seed` avant cette livraison
  (Phase 1 seule), les rôles Conseiller/Admissions/Visa/Comptable/Réception/Marketing existent déjà en base avec leur
  ancien jeu de permissions. Le seed ne les réécrit pas automatiquement (pour préserver vos éventuelles modifications
  faites dans l'interface) — il faudra leur accorder manuellement les nouvelles permissions (prospect, candidate,
  document, finance…) depuis l'écran **Rôles**. Sur une base neuve, le premier `npm run seed` crée directement les rôles
  avec l'intégralité des permissions de ces phases.
- **Logos par URL** : le téléversement de logos reste par URL ; celui des documents candidats, lui, est un vrai upload
  disque (voir plus haut).

## Écart avec le cahier des charges complet

Le cahier des charges initial (« prompt maître ») décrit 12 phases et environ 120 sections couvrant un ERP
complet (portail candidat, partenaires, communication/WhatsApp, IA, automatisations, multi-tenant SaaS…).
Cette livraison couvre les phases 1 à 7. État détaillé, honnête, phase par phase :

| Phase | Statut |
|---|---|
| 1 — Fondations | ✅ Fait |
| 2 — CRM | 🟡 Partiel — prospects, statuts, source, conversion, **Kanban livré, lead scoring livré, relances programmées livrées**. Manque : campagnes/UTM structurées (le champ « campagne » existe mais reste un texte libre, sans suivi de performance dédié) |
| 3 — Candidat | 🟡 Partiel — documents versionnés, checklist, chronologie, **portail candidat livré** (authentification séparée, profil, documents, candidatures, visa, factures/paiements, rendez-vous, invitation par e-mail). Manque : profil 360° complet (CIN, passeport avec expiration, éducation/langues/expérience détaillées), % de progression, Health Score |
| 4 — Catalogue | ✅ Fait — pays, universités, programmes, recherche filtrée, comparateur, pages publiques, lien depuis les candidatures. Manque : matching automatique candidat↔programme (score), favoris côté portail candidat (dépend de la Phase 3) |
| 5 — Admissions | 🟡 Partiel — candidatures avec statuts, liées au catalogue, **workflows automatiques (WHEN/THEN) et alertes deadlines centralisées livrés**. Manque : éditeur graphique de workflows (l'actuel est un formulaire, pas un canevas visuel) |
| 6 — Visa | 🟡 Partiel — **checklist dédiée livrée** (pré-remplie, avec centre/référence/date de dépôt), alertes déjà couvertes par l'agrégateur d'échéances de la Phase 5. Ce qui manque relève surtout de la Phase 10 (détection de problèmes façon « Dossier Intelligence », par ex. passeport bientôt expiré) |
| 7 — Finance | 🟡 Partiel — devis/factures/paiements/reçus/caisse/dépenses, **contrats et signature électronique livrés**. Manque : catalogue de services structuré (au-delà des lignes libres), commissions (dépend de la Phase 8 Partenaires) |
| 8 — Partenaires | ✅ Livré — gestion des partenaires, commissions par statut, portail partenaire isolé (lecture + commentaire) |
| 9 — Communication | 🟡 Partiel — **messagerie candidat ↔ agence livrée, lien WhatsApp direct livré**. Manque : inbox omnicanale (e-mail/réseaux sociaux), centre de templates, notifications push |
| 10 — Premium | ✅ Livré — rentabilité par candidat, prévisions financières, Health Score, Command Center, assistant IA, **OCR passeport**. Les automatisations WHEN/THEN sont déjà livrées en Phase 5 |
| 11 — Site public avancé | ✅ Livré — identité « Premium Travel Editorial » sur tout le site public, SEO technique, **blog** (rédaction dans `/blog-admin`, page publique `/blog`, 3 articles d'exemple à remplacer par vos propres textes), connexion candidat déjà couverte par le portail (Phase 3) |
| 12 — SaaS multi-agences | ✅ Livré — `/platform-admin` (réservé à `isPlatformAdmin`, jamais réglable depuis l'écran de gestion des employés) : créer une nouvelle agence cliente (avec son premier compte, ses rôles, sa branche), suivre sa formule et son abonnement. L'isolation par `organizationId` existe depuis la Phase 1 ; ceci n'y touche pas, ça gère seulement le cycle de vie de l'agence en tant que cliente de la plateforme |

Toutes les grandes phases métier du cahier des charges sont maintenant livrées. Ce qui reste (OCR, assistant
IA, blog/SEO avancé) est accessoire pour le fonctionnement quotidien d'une agence. La Phase 12 (SaaS
multi-tenant) est restée volontairement de côté : c'est une décision stratégique — revendre ou non ce logiciel
à d'autres agences — qui vous revient, pas quelque chose à construire de mon propre chef.

## Suggestions pour la suite

Ce sont des pistes, pas des manques bloquants — l'application est utilisable en l'état.

1. **PDF bilingue réel (FR/AR)** — `pdfkit` ne sait pas façonner (shaping) ni réordonner (RTL) le texte arabe : le
   livrer tel quel aurait produit des lettres arabes détachées et dans le mauvais sens, donc j'ai choisi de rester en
   français plutôt que de livrer un rendu cassé. Pour un vrai bilingue, la voie la plus fiable est un rendu HTML/CSS
   (qui gère nativement le RTL et la ligature arabe) imprimé en PDF via un headless Chrome (Puppeteer) ou `wkhtmltopdf`.
2. **Stockage des documents sur S3-compatible** (Scaleway, OVH, MinIO…) plutôt que sur disque local, pour la
   sauvegarde, la scalabilité horizontale et la résilience en cas de changement de serveur. Le `StorageService` actuel
   est écrit pour que ce changement reste localisé (une seule classe à remplacer).
3. **Automatisations : pas encore de notification candidat ni de déclencheur "facture en retard"** — sans portail
   candidat (aucun compte, aucun canal e-mail/WhatsApp branché), une action "notifier le candidat" n'aurait rien à
   notifier ; j'ai volontairement limité les actions à celles qui produisent un effet réel dès aujourd'hui (tâche,
   checklist, note). Le déclencheur "facture en retard" dépend d'une exécution planifiée (cron) plutôt que d'un
   événement métier — à ajouter avec la Phase 9 (communication) plutôt que forcé maintenant.
4. **Notifications/rappels** pour les tâches et rendez-vous (e-mail ou WhatsApp le jour J), notamment pour les
   rendez-vous d'ambassade qui sont souvent la partie la plus sensible au retard.
5. **Devise multiple** si l'agence facture parfois en EUR ou USD — le modèle stocke déjà une devise par devis/facture,
   il manque juste un taux de change pour les rapports consolidés.
6. **TVA / taxes sur les factures** si la réglementation tunisienne l'exige pour ce type de service — actuellement les
   montants des lignes sont nets, sans champ de taxe dédié.
7. **2FA et vérification d'e-mail** — utiles surtout le jour où un portail candidat (self-service) sera ouvert.
8. **Recherche globale, thème sombre, préférence de langue par utilisateur** — conforts d'usage, aucun n'est
   structurant.
9. **Rapports/exports** (Excel ou PDF) pour le CA du mois, le taux de conversion prospect→candidat, les paiements en
   retard — actuellement tout est consultable à l'écran mais rien n'est exportable en un clic.

## Correctif important dans cette livraison

`apps/api/nest-cli.json` avait `"deleteOutDir": true`, ce qui a causé le bug que vous avez rencontré (`dist\main.js`
introuvable après un `npm run build` qui se termine pourtant sans erreur). La cause exacte : cette option supprime
tout le dossier `dist` avant chaque compilation, mais si TypeScript utilise son cache incrémental
(`tsconfig.build.tsbuildinfo`), il continue de croire que rien n'a changé et **ne réécrit rien** — le dossier reste
vide alors même que la commande annonce un succès. Ce n'était donc pas propre à votre machine Windows : je l'ai
reproduit à l'identique de mon côté. C'est corrigé cette fois dans le fichier livré (`deleteOutDir: false`) ; si vous
aviez appliqué un correctif similaire à la main sur votre copie, vous pouvez le retirer, il est maintenant inutile.

## Deuxième correctif important dans cette livraison

Le site plantait entièrement (page blanche, erreur `INVALID_KEY` dans le terminal) sur **n'importe quelle page**,
pas seulement `/logs`. La cause : `messages/fr.json` et `messages/ar.json` contenaient des clés de traduction
comme `"auth.login"`, `"employee.create"` (les codes d'action du journal d'activité) écrites comme des clés
littérales avec un point dedans. Or next-intl traite systématiquement le point comme une imbrication, jamais
comme un caractère normal — donc `"auth.login": "..."` n'est pas une clé nommée « auth.login », c'est une
tentative de créer une clé `login` à l'intérieur d'un objet `auth`, ce qui entre en conflit avec les vraies clés
plates existantes et fait planter le chargement de **tous les messages**, y compris ceux qui n'ont rien à voir
avec le journal d'activité. Corrigé en restructurant ces clés en objets réellement imbriqués
(`actions: { auth: { login: "..." } } }`), qui est la façon correcte d'obtenir exactement le même résultat.

**J'ai aussi renforcé `scripts/check-i18n.mjs`** pour qu'il détecte ce cas précis à l'avenir : mon script de
vérification existant comparait les clés après les avoir « aplaties », donc une fausse clé plate `"auth.login"`
et une vraie imbrication `{auth:{login:...}}` produisaient exactement le même résultat aplati — invisibles l'une
de l'autre. Le script échoue maintenant explicitement si une clé JSON contient un point littéral, avant même
d'arriver jusqu'à vous.

## Identité visuelle « Study in World — Premium Travel Editorial »

La page d'accueil du site public a été refaite sur l'identité de marque fournie par l'agence (brief détaillé +
affiches publicitaires réelles). Ce qui est en place, et ce qui reste :

- **Couleurs de marque réelles** partout dans l'application (`--primary`, `--navy`, `--sw-sky` dans
  `globals.css`) — converties depuis les codes hexadécimaux exacts du brief (`#072C7A`, `#064BB5`, `#39A9ED`).
  Le bleu Study in World reste la couleur qui unifie tout le site, comme demandé.
- **Deux polices, une bascule par langue** : Poppins pour le français (identité de marque), Caveat pour les
  touches manuscrites — mais Poppins n'a aucun glyphe arabe. La version arabe utilise Readex Pro (déjà en place)
  à la place, sur les deux rôles, via une classe `lang-fr`/`lang-ar` sur `<html>` : l'identité ne doit jamais
  casser le rendu arabe, qui reste la priorité.
- **Logo recomposé en SVG/texte** (`components/study-world-logo.tsx`) plutôt qu'une image recadrée depuis une
  affiche : celles-ci n'ont pas de zone de logo isolée sur fond neutre (toujours un peu de texture ou de feuillage
  en arrière-plan), donc tout recadrage laissait des artefacts. Le SVG reste net à n'importe quelle taille.
- **Les 5 bannières de destination utilisées sont vos vraies affiches** (Brésil, Malte, Albanie, Hongrie,
  Lituanie), recadrées sur la zone photo + titre uniquement (`apps/web/public/images/destinations/`) — jamais
  une photo trouvée sur le web. Pour un pays sans affiche existante, la carte retombe sur un dégradé de couleurs
  de marque avec le drapeau, en attendant une vraie photo.
- **Composants réutilisables livrés** (`features/public/design-system.tsx`) : `BrushTitle`, `HandwrittenTagline`,
  `StudyWorldButton`, `FlagBadge`, `ServiceCard`, `DestinationCard`, `PostcardCard`, `JourneyTimeline`,
  `PlaneTrail`, `TravelSignpost`. Prêts à être réutilisés sur les autres pages.
- **Le site public est maintenant entièrement couvert** : destinations, université, programmes, comparaison et
  simulateur d'éligibilité utilisent tous la même identité (héros avec vraie photo ou dégradé de marque selon
  la destination, cartes organiques, animations au défilement).
- **Le portail candidat est maintenant entièrement couvert** (palier 50 % du brief) : tableau de bord, profil,
  documents, candidatures, visa (avec barre de progression sur la checklist), finance (avec barre de progression
  payé/total), messages (bulles arrondies aux couleurs de marque), contrats, rendez-vous — tous avec titres en
  Poppins, cartes qui se soulèvent au survol, apparition en cascade.
- **Administration** (palier 20 % du brief, volontairement discret) : tableau de bord, candidats, tâches,
  employés, branches, rôles, rendez-vous, dépenses, caisse, rapports financiers reçoivent une apparition douce
  à l'arrivée et des boutons arrondis — rien de plus, pour rester « clair, efficace, professionnel » comme
  demande le brief. **Le tableau Kanban des prospects n'a pas été touché** : il utilise le glisser-déposer natif
  du navigateur, et l'envelopper dans une animation aurait risqué de casser ce comportement pour un gain
  purement cosmétique — mauvais compromis. Reste : catalogue, paramètres, automatisations, partenaires (côté
  admin), compte — volontairement pas fait dans la même session pour ne pas sacrifier la qualité en essayant
  de tout couvrir à la fois.
- **Le portail partenaire est maintenant entièrement couvert** (palier 50 % du brief, comme le portail
  candidat) : tableau de bord, liste des candidats, détail candidat, commissions — mêmes titres en Poppins,
  cartes qui se soulèvent au survol, apparition en cascade, bulles de commentaire aux couleurs de marque.
- **Squelettes de chargement** (`components/ui/skeleton.tsx`) : remplacent le texte « Chargement... » par des
  blocs qui pulsent doucement, à la forme du contenu réel (lignes de tableau, cartes-chiffres, listes) —
  appliqués aux pages les plus consultées (tableaux de bord admin/candidat/partenaire, candidats, employés,
  et tout le portail candidat). C'est souvent le détail qui distingue un produit premium d'un produit basique.
- **Recherche globale** (`components/command-palette.tsx`, `Ctrl+K` / `Cmd+K`) : cherche parmi les candidats et
  les prospects en même temps, groupés par type, avec un raccourci clavier accessible depuis n'importe quelle
  page admin. Volontairement limité à ces deux-là : les tâches n'ont pas de recherche côté API pour l'instant,
  et il vaut mieux ne pas construire une fonctionnalité visible sur un endpoint qui n'existe pas encore.
- **Passe « visuel et animations » sur les trois espaces** (page d'accueil, admin, portails) : `framer-motion`
  ajouté, avec deux jeux de composants d'animation — `features/public/design-system.tsx` (`Reveal`,
  `RevealGroup`, `RevealItem`, pensés pour l'identité de marque) et `components/motion.tsx` (`FadeIn`,
  `StaggerGroup`, `StaggerItem`, neutres, pour l'admin et les portails). Les composants `Card` et `Button`
  partagés par toute l'application ont été enrichis une seule fois (ombres, transitions, effet ressort via la
  prop `hoverable`) — l'amélioration se propage donc à toutes les pages qui les utilisent déjà, sans devoir
  toucher chaque page une par une. Le menu latéral admin et les tableaux de bord (admin + candidat) ont reçu
  une passe complète ; les pages restantes suivront le même principe au fur et à mesure.

## SaaS multi-agences — ce qu'il faut savoir

- **`isPlatformAdmin` n'est jamais réglable depuis l'interface normale** — ni depuis l'écran de gestion des
  employés, ni depuis aucune permission du RBAC habituel. Le seul endroit où ce champ est écrit est le script
  de seed (`prisma/seed.ts`), qui le donne automatiquement au tout premier compte créé (le vôtre). Si vous
  avez besoin de le donner à un autre compte plus tard, ça se fait directement en base :
  ```sql
  UPDATE "User" SET "isPlatformAdmin" = true WHERE email = 'email-du-compte@exemple.com';
  ```
- **`/platform-admin` a son propre garde** (`PlatformAdminGuard`), volontairement indépendant du système de
  permissions habituel. C'est un choix de sécurité délibéré : un Super Admin d'une agence normale contourne
  automatiquement le garde de permissions habituel (`PermissionsGuard`) par son rôle — mais ça ne doit jamais
  suffire pour gérer TOUTES les agences de la plateforme. Testé explicitement : un compte `SUPER_ADMIN` sans
  `isPlatformAdmin` reste refusé.
- **Créer une nouvelle agence scaffolde tout ce qu'il faut pour qu'elle soit utilisable immédiatement** :
  organisation, paramètres, branche par défaut, rôle Super Admin (toutes les permissions existantes, qui sont
  globales à la plateforme, jamais dupliquées par agence), et le premier compte de cette agence — avec un mot
  de passe que vous choisissez, et un changement obligatoire à la première connexion, comme pour un employé.
- **Ceci ne touche pas à l'isolation des données métier** (candidats, prospects, finance...), qui existe déjà
  depuis la Phase 1 via `organizationId` sur chaque table. La Phase 12 gère seulement le cycle de vie de
  l'agence en tant que cliente de la plateforme (sa création, sa formule, son abonnement) — jamais ses données.
- **Facturation manuelle livrée** (décision explicite : aucun prestataire de paiement pour l'instant) : depuis
  la liste des agences, un bouton « Facturation » ouvre l'historique de chaque agence — ajouter une facture
  (montant, période, échéance), la marquer payée. Le champ « en retard » est calculé à chaque lecture, jamais
  écrit tout seul en base : le statut choisi par vous reste la seule source de vérité tant que vous ne le
  changez pas vous-même.
- **Ce qui reste, volontairement pas construit maintenant** : lien réel avec un prestataire de paiement (vous
  avez choisi le suivi manuel), personnalisation de marque par agence (logo/couleurs déjà réglables par agence
  depuis Paramètres, mais rien de plus poussé), inscription en libre-service (vous avez choisi de rester le
  seul à créer une nouvelle agence).

## Notifications — ce qu'il faut savoir

- **Interrogation régulière (toutes les 30 secondes), pas de WebSocket.** Un vrai temps réel demanderait une
  connexion permanente entre le navigateur et le serveur — plus de complexité et plus de choses qui peuvent
  casser, pour un gain que 30 secondes de délai ne justifient pas dans ce contexte (ce n'est pas un chat en
  direct, c'est une alerte « on vous a écrit » ou « on vous a assigné quelque chose »).
- **Seulement deux déclencheurs volontairement** : un message reçu d'un candidat (pour son conseiller assigné),
  une tâche assignée à quelqu'un d'autre que soi-même. Ne notifie jamais quand on s'assigne quelque chose à
  soi-même — testé explicitement. Ajouter d'autres déclencheurs (échéance qui approche, document déposé...) est
  possible plus tard, mais chaque nouveau déclencheur dilue les autres : mieux vaut peu de notifications
  vraiment utiles que beaucoup qu'on apprend à ignorer.

## Non vérifié dans l'environnement de développement de cette livraison
PostgreSQL a bien été installé et démarré pour tester la vraie migration, mais celle-ci a échoué pour une raison précise :
`prisma migrate dev` télécharge son moteur de migration natif depuis `binaries.prisma.sh`, un domaine que le bac à sable de
développement ne peut pas joindre (confirmé par les journaux de débogage : le moteur de secours en wasm ne suffit pas, seul
le vrai binaire, lancé en sous-processus, sait appliquer une migration). Ce n'est pas un problème du code ni du schéma :
sur votre machine ou votre serveur, ce domaine sera joignable normalement et `prisma migrate dev` fonctionnera sans rien
changer. Aucun Docker ni navigateur non plus dans cet environnement : les images n'ont pas été construites et l'interface
n'a pas été vue à l'écran (rendu serveur FR/AR contrôlé, `next build` et `tsc` OK sur les deux apps, 170 tests backend verts).
À faire au premier lancement : `prisma migrate dev`, connexion, création d'un employé, un tour de l'interface en français
puis en arabe, ouverture de la caisse, création d'un prospect jusqu'au paiement d'une facture, pour valider le parcours
complet de bout en bout avec de vraies données.
