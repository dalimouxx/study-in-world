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
cp .env.production.example .env
openssl rand -hex 24      # → POSTGRES_PASSWORD
openssl rand -base64 48   # → JWT_SECRET (refaire pour CANDIDATE_JWT_SECRET et PARTNER_JWT_SECRET)
nano .env                 # coller les secrets, choisir SEED_ADMIN_PASSWORD, régler le SMTP si disponible
chmod 600 .env
```

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

## Mises à jour

```bash
/srv/platforms/studyinworld/deploy/update.sh
```

## Sauvegarde de la base (conseillé : chaque nuit)

```bash
/srv/platforms/studyinworld/deploy/backup.sh   # écrit /var/backups/studyinworld/siw-AAAA-MM-JJ.sql.gz (garde 14 jours)
crontab -e   # ajouter : 30 2 * * * /srv/platforms/studyinworld/deploy/backup.sh
```
