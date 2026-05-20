const { Client, GatewayIntentBits, Partials } = require('discord.js');
const config = require('../config');
const { DatabaseManager } = require('./database/DatabaseManager');
const { ConfigService } = require('./services/configService');
const { PermissionService } = require('./services/permissionService');
const { CooldownService } = require('./services/cooldownService');
const { SanctionService } = require('./services/sanctionService');
const { CommandRegistry } = require('./commands/commandRegistry');
const { BackupService } = require('./services/backupService');
const { setupDiscordEvents } = require('./events/discordEvents');
const { setupInteractionHandlers } = require('./events/interactionHandlers');

const initializeBot = () => {
  const client = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMembers,
      GatewayIntentBits.GuildBans,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.MessageContent,
      GatewayIntentBits.GuildModeration
    ],
    partials: [Partials.Channel, Partials.GuildMember, Partials.Message, Partials.User]
  });

  const db = new DatabaseManager(config.databasePath, config.ownerId);
  const configService = new ConfigService(db, config);
  const permissionService = new PermissionService(db, configService);
  const cooldownService = new CooldownService(db);
  const sanctionService = new SanctionService({ db, configService, client });
  const backupService = new BackupService(config);
  const commandRegistry = new CommandRegistry({
    client,
    configService,
    sanctionService,
    permissionService,
    cooldownService,
    db,
    backupService
  });

  let schedulerHandle = null;

  setupDiscordEvents(client, db, sanctionService, configService, commandRegistry, backupService, (handle) => { schedulerHandle = handle; });
  setupInteractionHandlers(client, commandRegistry, sanctionService, configService, permissionService, db);

  const handleShutdown = () => {
    if (schedulerHandle) {
      clearInterval(schedulerHandle);
    }
    backupService.stopScheduler();
    client.destroy();
    process.exit(0);
  };

  process.on('SIGINT', handleShutdown);

  return { client, config, handleShutdown };
};

module.exports = { initializeBot };
