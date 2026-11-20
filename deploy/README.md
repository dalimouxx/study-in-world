# Déploiement sur le VPS (studyinworld.net)

Le VPS (`187.126.31.110`, Ubuntu 24.04, Docker) héberge déjà Tunicom et Fixi derrière une **passerelle Caddy
commune** : le conteneur `platforms-edge-gateway-1` (projet `/srv/platforms/edge`), seul à écouter sur les ports
80 et 443, et qui gère le HTTPS. Study in World s'y ajoute **sans toucher aux autres sites** :

- projet Docker séparé, `studyinworld` (base, API, site), sans aucun port ouvert sur le VPS ;
- l'API et le site rejoignent le réseau `platforms-studyinworld-edge`, déjà relié à la passerelle, sous les
  noms `studyinworld-api` et `studyinworld-web` ;
- un seul fichier ajouté à la passerelle : `/srv/platforms/edge/sites/studyinworld.caddy`.

Toutes les commandes se lancent sur le VPS, en SSH.

## 1. Domaine (à faire en premier : la propagation peut prendre de quelques minutes à quelques heures)

Chez le registraire, deux enregistrements **A** vers `187.126.31.110` : `studyinworld.net` et `www.studyinworld.net`
(supprimer les anciens A qui pointent ailleurs). Vérifier :

```bash
getent hosts studyinworld.net www.studyinworld.net     # doit afficher 187.126.31.110 pour les deux
```

## 2. Vérifications (lecture seule)

```bash
ls -la /srv/platforms/edge/sites/
docker network inspect platforms-studyinworld-edge --format '{{.Name}} : {{range .Containers}}{{.Name}} {{end}}'
```

Le réseau doit exister (seule la passerelle y est reliée pour l'instant) et le dossier `sites` ne doit pas déjà
contenir de fichier pour studyinworld.net.

## 3. Code et variables

```bash
mkdir -p /srv/platforms && cd /srv/platforms
git clone https://github.com/dalimouxx/study-in-world.git studyinworld && cd studyinworld/deploy
cp .env.production.example .env && chmod 600 .env
```

Secrets générés et écrits directement dans `.env`, sans jamais les afficher (ne pas les copier ailleurs) :

```bash
sed -i "s|^POSTGRES_PASSWORD=.*|POSTGRES_PASSWORD=$(openssl rand -hex 24)|" .env && for k in JWT_SECRET CANDIDATE_JWT_SECRET PARTNER_JWT_SECRET; do sed -i "s|^$k=.*|$k=$(openssl rand -base64 48 | tr -d '\n/+=')|" .env; done
```

Mot de passe de départ du Super Admin, saisi sans affichage : lettres, chiffres et `-` seulement, 10 caractères
ou plus, avec majuscule, minuscule et chiffre (sinon le compte n'est pas créé) :

```bash
read -rsp "Mot de passe Super Admin : " P && echo && sed -i "s|^SEED_ADMIN_PASSWORD=.*|SEED_ADMIN_PASSWORD=$P|" .env && unset P
```

Vérification sans afficher les valeurs (aucune ligne ne doit indiquer 0 caractère) :

```bash
awk -F= '/^(SEED_ADMIN_PASSWORD|POSTGRES_PASSWORD|JWT_SECRET|CANDIDATE_JWT_SECRET|PARTNER_JWT_SECRET)=/{v=substr($0,index($0,"=")+1); print $1 " : " length(v) " caractères"}' .env
```

Le SMTP (e-mails) se règle ensuite dans `.env` (`SMTP_HOST`, `SMTP_USER`, `SMTP_PASSWORD`…), puis
`docker compose -f docker-compose.prod.yml --env-file .env up -d`.

## 4. Démarrage

```bash
docker compose -f docker-compose.prod.yml --env-file .env up -d --build
docker compose -f docker-compose.prod.yml logs -f api     # attendre « API prête », puis Ctrl+C
docker compose -f docker-compose.prod.yml exec api wget -qO- http://localhost:4000/api/health   # {"status":"ok"}
```

Au premier démarrage, l'API crée les tables (migration `0_init`) et le compte Super Admin (`SEED_ADMIN_EMAIL`).

## 5. Passerelle Caddy (HTTPS)

```bash
cp /srv/platforms/studyinworld/deploy/caddy/studyinworld.caddy /srv/platforms/edge/sites/
docker exec platforms-edge-gateway-1 caddy validate --config /etc/caddy/Caddyfile --adapter caddyfile
docker exec platforms-edge-gateway-1 caddy reload --config /etc/caddy/Caddyfile --adapter caddyfile
```

`validate` vérifie toute la configuration **avant** le rechargement : en cas d'erreur, ne pas lancer `reload`
(Tunicom et Fixi continuent de tourner avec l'ancienne configuration). En cas de souci après le rechargement,
retirer le fichier et recharger :

```bash
rm /srv/platforms/edge/sites/studyinworld.caddy && docker exec platforms-edge-gateway-1 caddy reload --config /etc/caddy/Caddyfile --adapter caddyfile
```

Le certificat HTTPS est obtenu automatiquement dès que le domaine pointe vers le VPS (étape 1).

## 6. Première connexion

Ouvrir https://studyinworld.net, se connecter avec `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD` : un nouveau mot
de passe est demandé. Puis, dans **Paramètres** : coordonnées de l'agence (et en arabe), **Facturation** (activer
la TVA et le timbre), modèle de contrat arabe à relire.

## Alertes Telegram

Le groupe Telegram de l'équipe reçoit : nouveaux prospects du site, documents et messages des candidats, contrats
signés en ligne, commentaires des partenaires, nouveaux candidats, factures, paiements, erreurs serveur, chaque
déploiement (`update.sh`) et chaque panne du site (`watchdog.sh`). Jamais de pièce, de numéro de passeport, de
montant ni de contenu de message.

1. Dans Telegram, ouvrir **@BotFather**, envoyer `/newbot`, choisir un nom : il donne un **jeton** (token).
2. Créer le groupe d'équipe, y **ajouter le bot**, puis écrire `/start` dans le groupe.
3. Sur le VPS, enregistrer le jeton sans l'afficher, puis retrouver l'identifiant du groupe :

```bash
cd /srv/platforms/studyinworld/deploy && read -rsp "Jeton du bot : " T && echo && sed -i "s|^TELEGRAM_BOT_TOKEN=.*|TELEGRAM_BOT_TOKEN=$T|" .env && unset T
```

```bash
T=$(grep ^TELEGRAM_BOT_TOKEN= .env | cut -d= -f2-); curl -s "https://api.telegram.org/bot$T/getUpdates" | grep -o '"chat":{"id":-[0-9]*,"title":"[^"]*"' | sort -u; unset T
```

4. Reporter l'identifiant (nombre négatif, par exemple `-1001234567890`) dans `.env`, puis relancer :

```bash
sed -i "s|^TELEGRAM_CHAT_ID=.*|TELEGRAM_CHAT_ID=-1001234567890|" .env    # remplacer par le vrai identifiant
docker compose -f docker-compose.prod.yml --env-file .env up -d
. ./telegram.sh && tg "✅ <b>Alertes Study in World activées</b>"
```

5. Surveillance du site toutes les 5 minutes :

```bash
(crontab -l 2>/dev/null; echo "*/5 * * * * /srv/platforms/studyinworld/deploy/watchdog.sh >/dev/null 2>&1") | crontab -
```

## Double authentification

Obligatoire pour le Super Admin et les administrateurs (et les administrateurs de la plateforme) : à la première
connexion, ils sont conduits à l'activer (QR code à scanner avec Google Authenticator ou Microsoft Authenticator,
puis 10 codes de secours à garder). Facultative pour les autres employés, depuis « Mon compte ».

- Téléphone perdu d'un employé : le Super Admin réinitialise sa double authentification depuis la fiche de l'employé.
- **Secours** (le Super Admin a perdu son téléphone **et** ses codes de secours) — sur le VPS, en remplaçant l'e-mail :

```bash
cd /srv/platforms/studyinworld/deploy && docker compose -f docker-compose.prod.yml exec -T db psql -U siw -d siw -c "UPDATE \"User\" SET \"totpSecret\"=NULL, \"totpPendingSecret\"=NULL, \"totpEnabledAt\"=NULL, \"totpLastUsedStep\"=NULL, \"totpRecoveryCodes\"='{}' WHERE email='admin@studyinworld.net'"
```

  À la connexion suivante, le compte devra réactiver la double authentification.

## Mises à jour

```bash
/srv/platforms/studyinworld/deploy/update.sh
```

Le groupe Telegram reçoit le début, la réussite (avec la version) ou l'échec du déploiement.

## Sauvegarde hors du VPS (Backblaze B2)

Chaque nuit : la base, les documents des candidats et `deploy/.env`, dans une archive **chiffrée sur le VPS** avant
l'envoi vers Backblaze B2. B2 garde 30 jours, le VPS 7 jours. Le groupe Telegram reçoit « Sauvegarde réussie » ou
« Échec de la sauvegarde ».

### Mise en place (une fois)

1. **Backblaze** (backblaze.com, offre B2) : créer un compte, puis un compartiment (« Create a Bucket ») :
   nom par exemple `studyinworld-sauvegardes`, **Private**, **Object Lock : Enable**.
2. Dans ce compartiment :
   - **Object Lock** → « Default Retention Policy » : mode **Governance**, durée **30 jours**. Aucune archive ne
     peut être supprimée avant 30 jours, même avec la clé du VPS (protection contre un VPS piraté ou une erreur).
   - **Lifecycle Settings** → « Use custom lifecycle rules » : préfixe `studyinworld/`, cacher les fichiers après
     **30** jours, les supprimer **1** jour après. (C'est Backblaze qui efface les archives de plus de 30 jours.)
3. **Application Keys** → « Add a New Application Key » : accès **à ce compartiment seulement**, type **Read and
   Write**. Noter le `keyID` et la `applicationKey` (affichée une seule fois).
4. **Dans un gestionnaire de mots de passe, hors du VPS**, noter : le `keyID`, la `applicationKey`, et la phrase de
   chiffrement générée à l'étape 5. Sans elles, les sauvegardes sont illisibles si le VPS disparaît.
5. Sur le VPS :

```bash
apt-get install -y rclone gpg
cd /srv/platforms/studyinworld/deploy
grep -q '^BACKUP_PASSPHRASE=' .env || printf 'BACKUP_PASSPHRASE=\nB2_ACCOUNT_ID=\nB2_APPLICATION_KEY=\nB2_BUCKET=\n' >> .env
P=$(openssl rand -base64 48 | tr -d '\n/+='); sed -i "s|^BACKUP_PASSPHRASE=.*|BACKUP_PASSPHRASE=$P|" .env; echo "Phrase à noter dans le gestionnaire de mots de passe : $P"; unset P
read -rsp "keyID B2 : " K && echo && sed -i "s|^B2_ACCOUNT_ID=.*|B2_ACCOUNT_ID=$(printf %s "$K" | tr -d '[:space:]')|" .env && unset K
read -rsp "applicationKey B2 : " K && echo && sed -i "s|^B2_APPLICATION_KEY=.*|B2_APPLICATION_KEY=$(printf %s "$K" | tr -d '[:space:]')|" .env && unset K
sed -i "s|^B2_BUCKET=.*|B2_BUCKET=studyinworld-sauvegardes|" .env     # le nom de votre compartiment
```

6. Premier essai, puis chaque nuit à 2 h 30 :

```bash
/srv/platforms/studyinworld/deploy/backup.sh
(crontab -l 2>/dev/null | grep -v backup.sh; echo "30 2 * * * /srv/platforms/studyinworld/deploy/backup.sh >> /var/log/studyinworld-backup.log 2>&1") | crontab -
```

### Restaurer

Vérifier une sauvegarde **sans rien toucher** (base de contrôle à part, affiche les nombres d'utilisateurs, de
candidats et de documents) :

```bash
/srv/platforms/studyinworld/deploy/restore.sh 2026-11-20
```

Remplacer la production par une sauvegarde (demande de taper `RESTAURER`) :

```bash
/srv/platforms/studyinworld/deploy/restore.sh 2026-11-20 --production
```

**Sur un VPS neuf** : cloner le dépôt (étape 3), créer `deploy/.env` avec seulement les quatre lignes B2 et la phrase,
démarrer la base (`docker compose -f docker-compose.prod.yml --env-file .env up -d db`), lancer `restore.sh <date>`,
puis reprendre les réglages complets dans `/var/tmp/studyinworld-restore/env` et lancer `restore.sh <date> --production`.
