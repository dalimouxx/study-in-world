# Relances automatiques et messages tout prêts — document de conception

Date : 2026-11-16 · Branche : `feat/relances-messages` (créée à partir de `fix/trois-defauts`) · Chantiers 1 et 2 de l'étape 2

## 1. Intention

Le propriétaire perd « presque tout » son temps sur des tâches répétitives. Les deux premiers chantiers choisis :

1. **Relances automatiques.** La plateforme repère seule ce qu'il faut relancer (rendez-vous, prospects, factures,
   documents rejetés), au lieu de compter sur la mémoire des conseillers. Un client oublié ou un rendez-vous
   d'ambassade manqué, c'est un client perdu.
2. **Messages tout prêts.** Les messages habituels (rappels, documents à fournir, étapes du visa…) partent en un
   clic au lieu d'être retapés.

## 2. Décisions du propriétaire

| Sujet | Décision |
|---|---|
| Canaux | **A + C** : WhatsApp « en un clic » (lien `wa.me` avec texte pré-rempli, envoyé par le conseiller) **et** e-mail automatique. L'API WhatsApp Business (envoi 100 % automatique) est repoussée à plus tard. |
| Situations et délais | Validés tels que proposés (tableau du §4). |
| Page « Relances du jour » | Validée. |
| Modèles de messages | Modifiables par l'agence dans les Paramètres, en FR et en AR, avec variables. Un jeu par défaut est fourni. |
| Langue | Nouveau champ « langue préférée » (FR/AR) sur candidat et prospect ; les messages partent dans cette langue. |
| Déclenchement | **Option 3** : réveil intégré à l'API (planificateur) **et** adresse sécurisée appelable de l'extérieur, qui lancent le même travail. Un journal des envois empêche tout doublon. |

## 3. Objectifs, non-objectifs, anti-objectifs

**Objectifs**
- Chaque matin, sans action humaine : les e-mails automatiques partent et chaque conseiller reçoit son récapitulatif.
- À tout moment, chaque conseiller voit ses relances du jour et les traite en un clic (WhatsApp prêt à envoyer).
- L'agence rédige et modifie ses modèles de messages sans développeur.
- Chaque relance faite ou envoyée laisse une trace dans la chronologie du dossier.

**Non-objectifs**
- Pas d'API WhatsApp Business, ni de SMS.
- Pas de campagnes marketing en masse (envoi à tous les prospects d'un coup).
- Pas d'éditeur de règles de relance : les situations et délais sont fixes dans le code. Seuls les textes sont modifiables.
- Pas de file de tâches (Redis/BullMQ).

**Anti-objectifs (échec même si « ça marche »)**
- **Un e-mail envoyé deux fois** au même candidat pour la même raison le même jour, ou plus de 3 relances de facture.
- Un e-mail envoyé à un candidat **archivé ou supprimé**, ou à un prospect déjà converti ou perdu.
- Un message qui part dans la mauvaise langue, ou avec une variable non remplacée (`{prénom}` visible).
- Le planificateur qui fait planter ou ralentit l'API, ou une erreur d'envoi d'un seul e-mail qui arrête toute la tournée.
- L'adresse sécurisée appelable sans la clé secrète.
- Fuite entre agences : une relance d'une agence visible ou envoyée par une autre (tout est filtré par `organizationId`).

## 4. Les relances

Toutes les dates sont évaluées dans le **fuseau de l'agence** (`AgencySettings.timezone`, `Africa/Tunis` par défaut ; voir §13.3). « Demain » est la
journée calendaire suivante dans ce fuseau.

| Code | Situation détectée | Automatique (e-mail) | Relance du jour (conseiller) | Destinataire du conseiller |
|---|---|---|---|---|
| `APPOINTMENT_TOMORROW` | Rendez-vous `SCHEDULED` lié à un candidat (`relatedType=CANDIDATE`), qui commence demain | E-mail de rappel au candidat (s'il a un e-mail), une fois | WhatsApp de rappel | Conseiller assigné au candidat |
| `VISA_APPOINTMENT_TOMORROW` | `VisaFile.appointmentDate` demain, statut ni `APPROVED` ni `REFUSED` | E-mail de rappel au candidat, une fois | WhatsApp de rappel | Conseiller assigné au candidat |
| `PROSPECT_FOLLOW_UP` | Prospect non supprimé, statut ni `CONVERTED` ni `LOST`, `nextFollowUpAt` ≤ fin de journée aujourd'hui | Notification (cloche) au conseiller assigné, une fois par jour | WhatsApp de relance | Conseiller assigné au prospect |
| `INVOICE_OVERDUE` | Facture `ISSUED` ou `PARTIALLY_PAID`, `dueDate` < aujourd'hui, reste à payer > 0 | E-mail de rappel au candidat : au plus **3 fois**, **7 jours** minimum entre deux | WhatsApp de rappel de paiement | Conseiller assigné au candidat |
| `DOCUMENT_REJECTED` | Document `REJECTED` (non supprimé), rejeté depuis 7 jours au plus | E-mail au candidat avec la raison (`reviewNote`), une fois par document | WhatsApp « merci de renvoyer » | Conseiller assigné au candidat |
| `DAILY_DIGEST` | Chaque matin, pour chaque employé actif ayant au moins un élément | Notification (cloche) et e-mail à l'employé : ses rendez-vous, relances et échéances du jour | — | — |

**Exclusions communes**
- Candidat `ARCHIVED` ou supprimé, prospect supprimé, `CONVERTED` ou `LOST` : rien.
- Sans e-mail : pas d'e-mail. La relance apparaît quand même dans « Relances du jour ».
- Sans téléphone : le bouton WhatsApp est désactivé, avec une explication.
- Sans conseiller assigné : la relance va aux employés de la branche qui ont la permission de gérer ces dossiers.
  C'est au constructeur de choisir laquelle (§10), en restant cohérent avec les permissions existantes.

**Prospect sans date de relance :** aucune relance. La date `nextFollowUpAt` existe déjà et se saisit dans le formulaire.

## 5. Journal des relances (anti-doublon et historique)

Nouvelle table `ReminderLog` :

| Champ | Rôle |
|---|---|
| `organizationId` | isolation par agence |
| `kind` | code du §4 |
| `entityType`, `entityId` | rendez-vous, dossier visa, prospect, facture, document… |
| `channel` | `EMAIL`, `NOTIFICATION` ou `WHATSAPP` |
| `dedupeKey` | clé unique, par exemple `APPOINTMENT_TOMORROW:EMAIL:<appointmentId>` ou `PROSPECT_FOLLOW_UP:NOTIFICATION:<prospectId>:<jour>` |
| `status` | `SENT`, `SKIPPED` (pas d'e-mail, SMTP absent…) ou `FAILED` (avec l'erreur) |
| `sentById` | l'employé, pour un WhatsApp marqué « fait » ; vide pour l'automatique |
| `createdAt` | |

- Contrainte d'unicité sur (`organizationId`, `dedupeKey`). Le travail tente d'abord d'**insérer** la ligne, et
  n'envoie que si l'insertion réussit. Deux tournées simultanées ne peuvent donc pas envoyer deux fois.
- Factures : la clé inclut le numéro du rappel (`INVOICE_OVERDUE:EMAIL:<id>:1`, `…:2`, `…:3`). Le rappel n
  n'est tenté que si le rappel n−1 date de 7 jours ou plus.
- Pour un e-mail en échec, la ligne passe en `FAILED`. La tournée suivante peut le retenter : `FAILED` libère la clé.
- Chaque envoi réussi ou WhatsApp marqué « fait » ajoute aussi une entrée dans la **chronologie** du dossier
  (types existants `EMAIL` ou `NOTE`, avec un texte du genre « Rappel de rendez-vous envoyé par e-mail »).

## 6. La tournée du matin

- Service `RemindersService.runDaily(now?: Date)` : parcourt toutes les agences, détecte les situations du §4,
  envoie et journalise. Il est **idempotent** : on peut l'appeler plusieurs fois le même jour sans effet supplémentaire.
- Chaque envoi est isolé (try/catch) : une erreur n'arrête pas la tournée. Elle est enregistrée en `FAILED`.
- **Réveil intégré :** `@nestjs/schedule`, chaque heure ; ne traite que les agences où il est 07:xx en heure locale (§13.3). Il est désactivable avec la variable
  `REMINDERS_CRON_ENABLED=false` (utile si l'API tourne en plusieurs copies et qu'on préfère le réveil extérieur).
- **Réveil extérieur :** `POST /api/jobs/daily-reminders`, protégé par l'en-tête `Authorization: Bearer <JOBS_SECRET>`.
  Sans `JOBS_SECRET` configuré, la route répond toujours 404. Comparaison du secret à temps constant.
  Elle est utilisable par Vercel Cron ou par le cron d'un serveur.
- Résultat de la tournée : compteurs par code et par statut, renvoyés par la route et écrits dans les logs.

## 7. Page « Relances du jour »

- Route admin `/reminders`, entrée « Relances » dans la navigation. Accessible à tout employé qui a au moins une
  des permissions `prospect.view` ou `candidate.view` (pas de nouvelle permission).
- Calculée **à l'ouverture** (`GET /api/reminders/today`), avec la même détection que la tournée. Elle ne dépend
  donc pas du réveil.
- Par défaut : les relances **du conseiller connecté**. Un filtre « Toute l'agence » est réservé aux rôles qui voient
  tous les dossiers, selon la même logique de visibilité que les listes de candidats et de prospects.
- Chaque ligne affiche : la personne, la situation, la date ou le montant, le canal automatique déjà utilisé
  (« e-mail envoyé ce matin »), un bouton **WhatsApp** (modèle de la situation, dans la langue de la personne) et un
  lien vers le dossier.
- Cliquer sur WhatsApp ouvre `wa.me` avec le texte rempli **et** enregistre la relance comme faite (`ReminderLog`
  canal `WHATSAPP`, plus une entrée de chronologie). La ligne passe dans « Faites aujourd'hui ».
- Un widget « Relances du jour (n) » sur le tableau de bord renvoie vers cette page.
- Style Bento Pop, mêmes composants que le lot 2. Bilingue FR/AR.

## 8. Messages tout prêts

- Nouvelle table `MessageTemplate` : `organizationId`, `key` (identifiant stable), `channel` (`WHATSAPP` | `EMAIL`),
  `nameFr`, `nameAr`, `subjectFr`, `subjectAr` (e-mail seulement), `bodyFr`, `bodyAr`, `isSystem` (modèle lié à
  une relance, non supprimable), `updatedAt`.
- **Modèles par défaut**, créés au seed et à la création d'une agence (`platform-admin`), puis complétés au premier
  appel s'ils manquent :
  - liés aux relances (`isSystem`), en version WhatsApp et e-mail : rappel de rendez-vous, rappel de rendez-vous visa,
    relance de prospect, rappel de paiement, document à renvoyer, récapitulatif du matin (e-mail seulement) ;
  - libres : liste des documents à fournir, étapes du visa, bienvenue après inscription.
- **Variables**, écrites `{prenom}`, `{nom}`, `{date}`, `{heure}`, `{lieu}`, `{pays}`, `{montant}`, `{devise}`,
  `{facture}`, `{document}`, `{raison}`, `{agence}`, `{telephone_agence}`. Le remplacement se fait dans une seule
  fonction pure, testée :
  - une variable inconnue ou vide est **retirée proprement** (jamais `{prenom}` visible) ;
  - les dates sont formatées selon la langue du message, à l'heure de Tunis.
- **Paramètres → onglet « Messages »** :
  - liste des modèles, édition FR/AR côte à côte, aperçu avec des valeurs d'exemple, liste des variables cliquables ;
  - restauration du texte par défaut ;
  - permission existante de modification des paramètres.
- **Bouton « Envoyer un message »** sur le dossier candidat et sur la fiche prospect, à côté du bouton WhatsApp
  existant. Il propose de choisir un modèle, remplit les variables du dossier, laisse modifier le texte, puis
  ouvre WhatsApp. La chronologie note « Message WhatsApp : <nom du modèle> ».

## 9. Langue préférée

- Nouveau champ `preferredLanguage` (`fr` | `ar`, défaut `fr`) sur `Candidate` et `Prospect`, modifiable dans leurs
  formulaires. Il est **conservé lors de la conversion** prospect → candidat.
- Le formulaire de contact du site public et le simulateur l'enregistrent selon la langue de la page.

## 10. Contraintes techniques constatées

- NestJS + Prisma + PostgreSQL. Il n'existe pas de migrations dans le dépôt (`prisma db push`). Les nouvelles
  tables et le nouveau champ passent par le même mécanisme. Les migrations relèvent du chantier 4 et ne sont pas
  traitées ici.
- `MailService.send(to, subject, text, html?)` existe. Sans `SMTP_HOST`, il écrit dans les logs : les envois sont
  alors journalisés `SKIPPED` avec la raison « SMTP non configuré », jamais `SENT`.
- `NotificationsService.notify(...)` et l'enum `NotificationType` (`NEW_MESSAGE`, `TASK_ASSIGNED`) existent.
  On ajoute `REMINDER` et `DAILY_DIGEST`.
- La chronologie existe (`TimelineEntityType` PROSPECT/CANDIDATE, types `EMAIL`, `NOTE`…).
- `Appointment` est lié par `relatedType`/`relatedId`, sans clé étrangère vers le candidat.
- Tests API : Jest (`*.spec.ts`, Prisma simulé, comme les specs existantes). Tests web : `node --test` et
  `scripts/visual-check.mjs`.

## 11. Approches envisagées

1. **Réveil intégré seul :** le plus simple, mais une tournée est manquée si le serveur dort, et il y a un risque de
   doublon avec plusieurs copies.
2. **Réveil extérieur seul :** fiable partout, mais demande une configuration obligatoire.
3. **Les deux, avec un journal anti-doublon** *(retenue par le propriétaire)* : fonctionne d'office, avec un secours
   possible, et sans doublon grâce à la contrainte d'unicité du §5.
4. File de tâches Redis : écartée, trop lourde pour une agence.

## 12. Vérification

- Tests unitaires API, avec une horloge injectée (`now`) :
  - détection de chaque situation du §4, avec les cas limites : minuit à Tunis, rendez-vous annulé, candidat archivé,
    prospect converti, facture soldée, 4e relance de facture refusée, rejet de plus de 7 jours ;
  - idempotence : deux tournées le même jour donnent un seul envoi ;
  - isolation par agence ;
  - route protégée : 404 sans secret configuré, 401 avec une mauvaise clé, 200 avec la bonne.
- Tests de la fonction de remplacement des variables : variable manquante, langue, dates, caractères arabes.
- Vérification visuelle : page « Relances du jour » et onglet « Messages », en FR/AR, à 1280 et 390 px. Le clic
  WhatsApp produit un lien `wa.me` dont le texte ne contient aucune `{variable}` restante.
- Vérification de bout en bout en local :
  - avec un serveur SMTP de test (MailHog/Mailpit si disponible, sinon les logs), un appel à
    `POST /api/jobs/daily-reminders` envoie les e-mails attendus ;
  - un second appel n'envoie rien.

## 13. Précisions après relecture (choix de conception, à valider par le propriétaire)

1. **Visibilité.** Aujourd'hui, tout employé qui a `candidate.view` ou `prospect.view` voit déjà tous les dossiers
   de l'agence. Le filtre « Toute l'agence » est donc proposé à **tout employé qui peut ouvrir la page**. C'est un
   simple paramètre de requête, sans nouvelle règle d'autorisation. Les relances **sans conseiller assigné**
   apparaissent dans une section « Non assignées », visible de tous. Le récapitulatif du matin ne les contient pas.
2. **Documents rejetés.**
   - On ajoute un champ `reviewedAt`, renseigné au moment de la revue (approbation ou rejet). La fenêtre de 7 jours
     part de ce champ.
   - Un document rejeté est **ignoré dès qu'une version plus récente du même type existe** pour le candidat, quel
     que soit son statut : le candidat a déjà renvoyé le document.
   - Les documents rejetés avant cette livraison (sans `reviewedAt`) ne déclenchent rien.
3. **Fuseau horaire.** On utilise le fuseau **de chaque agence** (`AgencySettings.timezone`, `Africa/Tunis` par
   défaut), pas un fuseau fixe. Le réveil intégré tourne **chaque heure** et ne traite que les agences pour
   lesquelles il est entre 07:00 et 07:59 en heure locale. La route extérieure traite toutes les agences dont la
   tournée du jour (dans leur fuseau) n'a pas encore été faite. Le journal anti-doublon garantit une seule tournée.
   Les dates des messages sont formatées dans ce même fuseau.
4. **Ce que veut dire « faite ».**
   - Rendez-vous et rendez-vous visa : faite **une fois pour toutes** (clé par rendez-vous).
   - Prospect : cliquer sur WhatsApp ouvre ensuite un petit choix **« Prochaine relance le… »** (par défaut dans
     3 jours, modifiable, ou « aucune »), qui met à jour `nextFollowUpAt`. La relance disparaît alors jusqu'à cette
     date. Sans réponse, elle est marquée faite **pour aujourd'hui** et revient demain.
   - Facture : faite **pour le cycle de 7 jours en cours**. Elle revient au cycle suivant tant que la facture n'est
     pas réglée. Les clics WhatsApp ne comptent pas dans la limite de 3 e-mails.
   - Document rejeté : faite une fois pour toutes (clé par document).
5. **Envois ignorés (`SKIPPED`).**
   - Un envoi ignoré (pas d'e-mail, SMTP absent) **ne consomme pas** la relance : il est retenté à la tournée
     suivante, tant que la situation est encore valable (par exemple, le rendez-vous est toujours « demain »).
   - Il ne compte ni dans les 3 rappels de facture, ni pour le délai de 7 jours.
   - Il est enregistré pour l'historique, mais ne bloque pas la clé. La clé n'est verrouillée que par `SENT`.
6. **Langue du récapitulatif du matin :** celle de l'employé (`User.locale`).

## 14. Laissé au constructeur

- Le texte exact des modèles par défaut (ton chaleureux, vouvoiement, court ; arabe standard moderne).
- La présentation détaillée de la page et de l'onglet, dans le style Bento Pop existant.
- La règle précise de repli quand aucun conseiller n'est assigné (§4), à documenter.
- Le découpage en services et modules NestJS (par exemple `reminders/`, `message-templates/`, `jobs/`).
- Le format HTML des e-mails : simple, lisible, aux couleurs de l'agence, avec une version texte.
