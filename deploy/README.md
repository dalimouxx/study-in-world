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

## Mises à jour

```bash
/srv/platforms/studyinworld/deploy/update.sh
```

## Sauvegarde de la base (conseillé : chaque nuit)

```bash
/srv/platforms/studyinworld/deploy/backup.sh   # écrit /var/backups/studyinworld/siw-AAAA-MM-JJ.sql.gz (garde 14 jours)
crontab -e   # ajouter : 30 2 * * * /srv/platforms/studyinworld/deploy/backup.sh
```
