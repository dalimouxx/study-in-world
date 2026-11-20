# Alertes Telegram — conception courte

Date : 2026-11-20 · Branche : `feat/telegram-alertes` (à partir de `deploy/vps`)

## Intention
Le propriétaire veut être prévenu sur Telegram, **dans un groupe d'équipe**, de tout ce qui se passe : ce qui arrive
de l'extérieur, l'activité de l'équipe, chaque déploiement et chaque problème.

## Décisions du propriétaire
- Événements : **tous** (arrivées de l'extérieur, activité de l'équipe, déploiements, problèmes).
- Destination : **un groupe Telegram d'équipe**.
- Approche **A** : alertes envoyées par la plateforme elle-même ; site en panne surveillé par **un script sur le VPS**.
  Écartées : réutiliser la cloche de notifications (peu d'événements, une personne à la fois) ; UptimeRobot.

## Conception
- **Configuration** : `TELEGRAM_BOT_TOKEN` et `TELEGRAM_CHAT_ID` dans `deploy/.env` (jamais dans le code). Absents :
  aucune alerte, rien ne casse.
- **API** (`src/alerts/`) : `AlertsService.emit(événement)` envoie un message court, en français, avec un lien vers la
  fiche. **Jamais bloquant** : l'envoi part en arrière-plan, une erreur Telegram est seulement journalisée.
- **Événements** :
  - extérieur : nouveau prospect (formulaire du site), document déposé, message d'un candidat, contrat signé en ligne,
    commentaire d'un partenaire ;
  - équipe : nouveau candidat, facture émise, paiement enregistré ;
  - problèmes : erreur serveur (500), **au plus une alerte toutes les 10 minutes pour la même erreur**.
- **Confidentialité** : type d'événement, nom, numéro de document, lien. **Jamais** de pièce, de numéro de
  passeport, de montant ni de contenu de message.
- **VPS** : `update.sh` annonce le début, la réussite (avec la version) ou l'échec d'un déploiement ;
  `watchdog.sh` (cron toutes les 5 minutes) teste le site et l'API, prévient après **2 échecs de suite**, et prévient
  au retour.

## Vérification
Tests du formatage des messages, du non-blocage, de la limite des erreurs ; tests des points d'émission ; envoi réel
sur Telegram une fois le bot créé par le propriétaire.
