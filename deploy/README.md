# Déploiement sur le VPS (studyinworld.net)

Le VPS héberge déjà d'autres sites (Tunicom, Fixi). Study in World s'installe **à côté, sans les toucher** :
- projet Docker séparé (`studyinworld`) ;
- ports locaux qui lui sont propres (3100 pour le site, 4100 pour l'API, sur 127.0.0.1 seulement) ;
- un fichier Nginx de plus pour le domaine `studyinworld.net`.

Toutes les commandes se lancent sur le VPS, connecté en SSH (`ssh root@187.126.31.110`, ou votre utilisateur avec `sudo`).

## 0. Diagnostic (lecture seule, ne modifie rien)

```bash
uname -a; cat /etc/os-release | head -2; free -h; df -h /
docker --version; docker compose version
nginx -v; ls /etc/nginx/sites-enabled/ 2>/dev/null; ls /etc/nginx/conf.d/ 2>/dev/null
ss -ltnp | grep -E ':(80|443|3000|3100|4000|4100|5432) '
docker ps --format '{{.Names}}\t{{.Ports}}'
```

Le résultat dit comment Tunicom et Fixi sont servis (Nginx installé sur le VPS, ou un proxy dans Docker) et si
les ports 3100/4100 sont libres. **S'ils sont pris**, changer `WEB_PORT`/`API_PORT` dans `deploy/.env` et les
mêmes nombres dans le fichier Nginx.

## 1. Domaine

Chez le registraire du domaine, deux enregistrements **A** vers `187.126.31.110` : `studyinworld.net` et
`www.studyinworld.net`. Vérifier depuis le VPS :

```bash
getent hosts studyinworld.net www.studyinworld.net
```

## 2. Code et variables

```bash
cd /opt && git clone https://github.com/dalimouxx/study-in-world.git studyinworld && cd studyinworld/deploy
cp .env.production.example .env
openssl rand -hex 24      # → POSTGRES_PASSWORD
openssl rand -base64 48   # → JWT_SECRET (refaire pour CANDIDATE_JWT_SECRET et PARTNER_JWT_SECRET)
nano .env                 # coller les secrets, choisir SEED_ADMIN_PASSWORD, régler le SMTP si disponible
chmod 600 .env
```

## 3. Démarrage

```bash
docker compose -f docker-compose.prod.yml --env-file .env up -d --build
docker compose -f docker-compose.prod.yml logs -f api     # attendre « API prête », puis Ctrl+C
curl -s http://127.0.0.1:4100/api/health && curl -sI http://127.0.0.1:3100 | head -1
```

Au premier démarrage, l'API crée les tables (migration `0_init`) et le compte Super Admin (`SEED_ADMIN_EMAIL`).

## 4. Nginx et HTTPS

Si le diagnostic montre un Nginx installé sur le VPS :

```bash
cp /opt/studyinworld/deploy/nginx/studyinworld.net.conf /etc/nginx/sites-available/studyinworld.net
ln -s /etc/nginx/sites-available/studyinworld.net /etc/nginx/sites-enabled/
nginx -t && systemctl reload nginx        # nginx -t vérifie AVANT de recharger : les autres sites restent en ligne
certbot --nginx -d studyinworld.net -d www.studyinworld.net
```

(Si `certbot` manque : `apt install certbot python3-certbot-nginx`.)

## 5. Première connexion

Ouvrir https://studyinworld.net, se connecter avec `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD` : un nouveau mot
de passe est demandé. Puis, dans **Paramètres** : coordonnées de l'agence (et en arabe), **Facturation** (activer
la TVA et le timbre), modèle de contrat arabe à relire.

## Mises à jour

```bash
/opt/studyinworld/deploy/update.sh
```

## Sauvegarde de la base (conseillé : chaque nuit)

```bash
/opt/studyinworld/deploy/backup.sh          # écrit /var/backups/studyinworld/siw-AAAA-MM-JJ.sql.gz (garde 14 jours)
crontab -e   # ajouter : 30 2 * * * /opt/studyinworld/deploy/backup.sh
```
