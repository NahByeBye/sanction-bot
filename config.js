require('dotenv').config();

const validateConfig = () => {
  const errors = [];

  if (!process.env.DISCORD_TOKEN || process.env.DISCORD_TOKEN === 'REPLACE_WITH_YOUR_TOKEN') {
    errors.push('DISCORD_TOKEN must be set in .env file');
  }

  if (!process.env.CLIENT_ID) {
    errors.push('CLIENT_ID must be set in .env file');
  }

  if (!process.env.GUILD_ID) {
    errors.push('GUILD_ID must be set in .env file');
  }

  if (!process.env.OWNER_ID) {
    errors.push('OWNER_ID must be set in .env file');
  }

  if (errors.length > 0) {
    console.error('Configuration errors:');
    errors.forEach(error => console.error(`  - ${error}`));
    process.exit(1);
  }
};

validateConfig();

module.exports = {
  token: process.env.DISCORD_TOKEN,
  clientId: process.env.CLIENT_ID,
  guildId: process.env.GUILD_ID,
  ownerId: process.env.OWNER_ID,
  prefix: process.env.PREFIX || "&",
  color: process.env.COLOR || "#01081f",
  footer: process.env.FOOTER || "powered by mysoulislost",
  enablePrefixCommands: process.env.ENABLE_PREFIX_COMMANDS !== 'false',
  enforceReason: process.env.ENFORCE_REASON !== 'false',
  databasePath: process.env.DATABASE_PATH || "./data/sanctions.sqlite",
  defaultCooldownSeconds: parseInt(process.env.DEFAULT_COOLDOWN_SECONDS) || 5,

  backupEnabled: process.env.BACKUP_ENABLED !== 'false',
  backupIntervalMinutes: parseInt(process.env.BACKUP_INTERVAL_MINUTES) || 60,
  maxBackups: parseInt(process.env.MAX_BACKUPS) || 10,
  backupDir: process.env.BACKUP_DIR || "./data/backups"
};
