# Sanction Bot

Discord moderation bot with full sanction management, supporting both slash and prefix commands.

## Configuration

1. Copy `config.js` and replace the placeholder values:
   - `token`: Discord bot token.
   - `clientId`: application client ID.
   - `guildId`: optional, restricts slash command registration to a specific guild.
   - `ownerId`: primary owner ID.
   - `prefix`: prefix for text commands.
   - `color` and `footer`: embed customization.
2. Adjust feature toggles if needed: `enableSlashCommands`, `enablePrefixCommands`, `enforceReason`.

## Installation

```powershell
npm install
```

> **Note:** `better-sqlite3` requires C++ build tools on Windows.
> - Recommended: use Node.js 20 LTS.
> - Otherwise install the "Desktop development with C++" workload from Visual Studio Build Tools.

## Usage

```powershell
npm run start
```

Re-register slash commands after any modification:

```powershell
npm run register:slash
```

## Core Features

- Ban, kick, tempban, mute, tempmute, warn, blacklist, and tempblacklist sanctions.
- Unban, unmute, and unblacklist actions recorded in the database.
- Sanction history per user with filtering options.
- Detailed SQLite storage: actor, target, reason, timestamps, duration, status.
- Owner management (add/remove/list) with a designated primary owner.
- Slash commands (`/ban`, `/kick`, `/mute`, etc.) and prefix commands (`&ban`, `&kick`, `&tempban`, etc.).
- Independent toggles for slash and prefix modes via `/botconfig toggle ...`.
- Fine-grained configuration of authorized roles, cooldowns, and daily limits through `/botconfig` or `&config`.
- Consistent embeds using the color and footer defined in `config.js`.
- User blacklist to prevent access to bot commands.
- Automatic expiration handling for temporary sanctions.

## Administrative Commands

- `/owner add|remove|list` or `&owner add|remove|list`.
- `/botconfig toggle|roles|cooldown|limit` or `&config toggle|roles|cooldown|limit`.
- `&listsanctions <user> [type]` or `/listsanctions`.

## Database

The SQLite file is created at `data/sanctions.sqlite`. Back up this file to preserve sanction history.

## Development

- Nodemon available via `npm run dev`.
- The sanction service scans every 60 seconds to lift expired temporary sanctions.
