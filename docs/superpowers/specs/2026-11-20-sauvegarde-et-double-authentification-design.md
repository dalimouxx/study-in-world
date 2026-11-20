# Chantier 4 — sauvegarde hors du VPS et double authentification — conception

Date : 2026-11-20 · Branche : `feat/chantier-4` (à partir de `feat/telegram-alertes`, qui contient `deploy/vps`)

## 1. Intention

Rendre la plateforme **solide** face aux deux risques que le propriétaire veut couvrir, **les deux** :
1. **Perdre les données** : panne ou corruption du VPS, suppression par erreur. Aujourd'hui la base, les documents
   des candidats et la seule sauvegarde (`deploy/backup.sh`, base seulement, sur le même disque) sont au même endroit.
2. **Une intrusion dans le compte d'un employé** : aujourd'hui, un mot de passe suffit (verrouillage après 5 essais).

Ordre : la sauvegarde d'abord (une perte de données est irréversible), puis la double authentification.

Point du chantier 4 initial déjà fait : les **migrations Prisma** (`0_init`, branche `deploy/vps`). Le stockage S3
des documents n'est plus utile sur le VPS (volume Docker persistant) : il est remplacé par la sauvegarde hors du VPS.

## 2. Décisions du propriétaire

| Sujet | Décision |
|---|---|
| Sauvegarde | **A — espace de stockage en ligne, Backblaze B2**. Écartées : Google Drive (liaison délicate, peu fait pour l'automatique) ; sauvegardes de l'hébergeur (même fournisseur, hebdomadaires, pas de fichier à l'unité). |
| Double authentification | **A — code d'une application** (Google Authenticator, Microsoft Authenticator…) avec **codes de secours**. Écartées : code par e-mail (pas de SMTP, moins sûr) ; code par le bot Telegram (dépendance à Telegram, liaison par employé). |
| Qui | Employés seulement. **Obligatoire pour le Super Admin et les administrateurs** (rôles `SUPER_ADMIN`, `ADMIN`), **facultative pour les autres**. Candidats et partenaires non concernés. |

## 3. Sauvegarde hors du VPS

### Objectifs
- Chaque nuit : la **base** (`pg_dump`) **et les documents** (volume `studyinworld_documents`) dans une seule archive,
  **chiffrée sur le VPS avant l'envoi** (Backblaze ne peut pas la lire), envoyée sur B2.
- **30 jours** gardés sur B2 ; 7 jours en local (restauration rapide).
- Telegram : « ✅ Sauvegarde réussie (taille) » ou « ❌ Échec de la sauvegarde (étape) » chaque nuit.
- **Restauration écrite et testée** : `deploy/restore.sh <date>` récupère, déchiffre et restaure base et documents.

### Anti-objectifs
- Une archive envoyée **en clair**.
- Une **phrase de chiffrement gardée seulement sur le VPS** : si le VPS meurt, les sauvegardes deviennent illisibles.
  Le guide exige de la noter dans un gestionnaire de mots de passe (hors VPS) dès l'installation.
- Une sauvegarde qui échoue en silence.
- Une restauration jamais essayée.

### Conception
- Outils sur le VPS : `rclone` (envoi vers B2 avec une clé d'application limitée au compartiment) et `gpg`
  (chiffrement symétrique AES-256, déjà présent sur Ubuntu).
- `deploy/.env` : `B2_ACCOUNT_ID` (keyID), `B2_APPLICATION_KEY`, `B2_BUCKET`, `BACKUP_PASSPHRASE`. Rien de tout cela
  n'est affiché par les scripts ni envoyé sur Telegram.
- `deploy/backup.sh` (réécrit) : dump de la base + `tar` du volume des documents → `siw-AAAA-MM-JJ.tar.gz.gpg` →
  envoi B2 → suppression en local des archives de plus de 7 jours → Telegram (voir §6 pour les 30 jours sur B2).
- `deploy/restore.sh AAAA-MM-JJ` : par défaut, restaure dans une **base de contrôle séparée** et un dossier à part, et
  affiche le nombre de candidats et de documents (vérification sans risque) ; avec `--production`, après confirmation
  tapée, arrête l'API, remplace base et documents, relance.
- Le compartiment B2 est **privé** ; la clé d'application n'a accès qu'à lui.

## 4. Double authentification

### Objectifs
- Un employé active la double authentification depuis **Mon compte** : QR code à scanner, puis un code à 6 chiffres
  pour confirmer ; il reçoit alors **10 codes de secours** à usage unique, affichés une seule fois.
- À la connexion : e-mail + mot de passe, puis **code à 6 chiffres** (ou un code de secours).
- `SUPER_ADMIN` et `ADMIN` (et administrateurs de la plateforme, §6) sans double authentification : après le mot de passe, ils sont **obligés de l'activer**
  avant d'accéder à quoi que ce soit (comme le changement de mot de passe obligatoire actuel).
- Téléphone perdu : un Super Admin peut **réinitialiser** la double authentification d'un autre employé (journalisé) ;
  l'employé la réactive à sa connexion suivante.

### Anti-objectifs
- Le **secret** d'un employé stocké en clair dans la base (il est chiffré avec une clé de `deploy/.env`).
- Des codes de secours stockés en clair (ils sont hachés, comme les mots de passe).
- Un code à 6 chiffres devinable par essais : les erreurs de code comptent dans le verrouillage existant (5 essais).
- Un Super Admin qui se bloque lui-même sans recours : codes de secours + procédure de secours sur le VPS (commande
  qui désactive la double authentification d'un compte, documentée dans le guide).

### Conception
- Bibliothèques : `otplib` (codes TOTP, standard RFC 6238, 30 s, tolérance ±1 période) et `qrcode` (image du QR).
- `User` : `totpSecret String?` (chiffré AES-256-GCM avec `TOTP_ENCRYPTION_KEY`), `totpEnabledAt DateTime?`,
  `totpRecoveryCodes String[]` (hachés argon2) — nouvelle migration Prisma.
- Connexion en deux temps : si l'employé a la double authentification, `POST /auth/login` ne donne **pas** de session,
  mais un **jeton d'étape** (5 minutes, usage limité à `POST /auth/2fa/verify`). `POST /auth/2fa/verify {jeton, code}`
  donne la session (mêmes jetons et cookie qu'aujourd'hui).
- Activation : `POST /auth/2fa/setup` (secret provisoire + QR), `POST /auth/2fa/enable {code}` (→ codes de secours),
  `POST /auth/2fa/disable {mot de passe, code}` (interdit si le rôle l'exige), `POST /users/:id/2fa/reset` (Super Admin).
- Rôle qui l'exige et pas encore activée : la session est donnée avec `mustSetupTwoFactor: true` ; l'API refuse tout
  sauf la mise en place (comme `mustChangePassword`), le web redirige vers la page de mise en place.
- Web : étape « code » sur la page de connexion, section « Double authentification » dans Mon compte, page de mise
  en place obligatoire, bouton de réinitialisation dans la fiche d'un employé (Super Admin). FR et AR.

## 5. Vérification
- Sauvegarde : test complet en local (MinIO ou dossier rclone local à la place de B2) : sauvegarde → restauration
  dans une base de contrôle → mêmes nombres de candidats et documents ; archive illisible sans la phrase.
- Double authentification : tests des codes (bon, mauvais, expiré, code de secours une seule fois), du jeton d'étape,
  du verrouillage, de l'obligation pour `ADMIN`/`SUPER_ADMIN`, de la réinitialisation ; parcours réel au navigateur
  avec un code généré par `otplib`.
- `visual-check` : connexion (étape code), Mon compte, page de mise en place, FR et AR.

## 6. Choix du constructeur (après relecture, à vérifier par le propriétaire)
1. **`deploy/.env` est inclus dans l'archive chiffrée.** Sans lui, une restauration sur un nouveau VPS perdrait la clé
   des secrets de double authentification (tous les comptes à réinitialiser) et les autres secrets. Le gestionnaire de
   mots de passe du propriétaire garde donc **trois choses** : `BACKUP_PASSPHRASE`, l'identifiant et la clé B2.
2. **La clé B2 du VPS ne peut pas supprimer** (droits : lister, lire, écrire). La conservation de 30 jours est faite
   par une **règle de cycle de vie du compartiment** chez Backblaze. Ainsi, même un VPS piraté ou un script fautif ne
   peut pas effacer les sauvegardes déjà envoyées. Le script ne supprime que les copies locales.
3. **Obligation de la double authentification** : rôles `SUPER_ADMIN` et `ADMIN` de **toutes les agences**, et tout
   compte **administrateur de la plateforme** (`isPlatformAdmin`), quel que soit son rôle.
4. **Blocage côté serveur** : un garde global de l'API refuse toute requête d'un compte qui doit mettre en place la
   double authentification, sauf la mise en place elle-même, `GET /auth/me` et la déconnexion. Le changement de mot
   de passe obligatoire reste tel qu'aujourd'hui (contrôlé par le web) : hors de ce chantier.
5. **Sessions déjà ouvertes** : l'obligation est recalculée à chaque rafraîchissement de session (toutes les 15
   minutes au plus) ; un administrateur déjà connecté est donc conduit à la mise en place dans le quart d'heure,
   sans déconnecter tout le monde au déploiement.

## 7. Laissé au constructeur
- Le détail des écrans (texte, mise en page) dans le style Bento Pop existant.
- L'heure de la sauvegarde nocturne (2 h 30 proposée, comme le cron actuel).
