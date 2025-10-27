# Sanction Bot

Bot de modération Discord avec gestion complète des sanctions, compatible commandes slash et préfixe.

## Configuration

1. Copier `config.js` et remplacer les valeurs par défaut :
   - `token` : token du bot Discord.
   - `clientId` : identifiant de l'application.
   - `guildId` : optionnel, pour enregistrer les slash commands sur un serveur spécifique.
   - `ownerId` : identifiant du propriétaire principal du bot.
   - `prefix` : préfixe des commandes texte.
   - `color` et `footer` : personnalisation des embeds.
2. Ajuster si besoin les options `enableSlashCommands`, `enablePrefixCommands` et `enforceReason`.

## Installation

```powershell
npm install
```

> **Note :** `better-sqlite3` requiert les outils de build C++ sur Windows.
> - Option recommandée : utiliser Node.js 20 LTS.
> - Sinon, installer le workload "Desktop development with C++" des Visual Studio Build Tools.

## Utilisation

```powershell
npm run start
```

Pour enregistrer les commandes slash après modification :

```powershell
npm run register:slash
```

## Fonctionnalités principales

- Ban, kick, tempban, mute, tempmute, warn, blacklist et tempblacklist.
- Unban, unmute et unblacklist enregistrés en base.
- Listing des sanctions par utilisateur.
- Stockage SQLite détaillé : auteur, victime, raison, dates, durée, statut.
- Gestion des owners (ajout/retrait/listing) avec owner principal défini.
- Commandes disponibles en slash (`/ban`, `/kick`, `/mute`, etc.) et préfixe (`&ban`, `&kick`, `&tempban`, etc.).
- Possibilité d'activer/désactiver indépendamment slash/prefix (`/botconfig toggle ...`).
- Configuration fine des rôles autorisés, cooldowns et limites quotidiennes par action via `/botconfig` ou commandes préfixées `&config`.
- Embeds homogènes avec couleur et footer définis dans `config.js`.
- Blacklist utilisateurs pour bloquer l'accès au bot.
- Processus automatique de levée des sanctions temporaires.

## Commandes administratives

- `/owner ajouter|retirer|liste` ou `!owner ajouter|retirer|liste`.
- `/botconfig toggle|roles|cooldown|limite` ou `!config toggle|roles|cooldown|limit`.
- `!listsanctions <utilisateur> [type]` ou `/listsanctions`.

## Base de données

Le fichier SQLite est créé dans `data/sanctions.sqlite`. Pensez à sauvegarder ce fichier pour conserver l'historique.

## Développement

- Nodemon disponible via `npm run dev`.
- Le service de sanctions réalise un scan toutes les 60 secondes pour lever automatiquement les sanctions expirées.
