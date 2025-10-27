const { Client, GatewayIntentBits, Partials, Events } = require('discord.js');
const config = require('../config');
const { DatabaseManager } = require('./database/DatabaseManager');
const { ConfigService } = require('./services/configService');
const { PermissionService } = require('./services/permissionService');
const { CooldownService } = require('./services/cooldownService');
const { SanctionService } = require('./services/sanctionService');
const { CommandRegistry } = require('./commands/commandRegistry');

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
const commandRegistry = new CommandRegistry({
  client,
  configService,
  sanctionService,
  permissionService,
  cooldownService,
  db
});

let schedulerHandle = null;

client.once(Events.ClientReady, async () => {
  console.log(`Connecté en tant que ${client.user.tag}`);

  if (configService.areSlashCommandsEnabled()) {
    try {
      await commandRegistry.registerSlashCommands();
      console.log('Slash commands synchronisées.');
    } catch (error) {
      console.error('Impossible de synchroniser les slash commands:', error);
    }
  }

  const processExpirations = async () => {
    try {
      await sanctionService.processExpiredSanctions();
    } catch (error) {
      console.error('Erreur lors du traitement des sanctions expirées:', error);
    }
  };

  await processExpirations();
  schedulerHandle = setInterval(processExpirations, 60_000);
});

client.on(Events.InteractionCreate, async (interaction) => {
  if (!interaction.isChatInputCommand()) {
    return;
  }
  if (!configService.areSlashCommandsEnabled()) {
    return;
  }
  try {
    await commandRegistry.handleSlashInteraction(interaction);
  } catch (error) {
    console.error('Erreur lors du traitement de la slash command:', error);
    if (!interaction.replied) {
      await interaction.reply({ content: 'Une erreur est survenue.', ephemeral: true }).catch(() => {});
    }
  }
});

client.on(Events.MessageCreate, async (message) => {
  try {
    await commandRegistry.handleMessage(message);
  } catch (error) {
    console.error('Erreur lors du traitement de la commande prefix:', error);
  }
});

process.on('SIGINT', () => {
  if (schedulerHandle) {
    clearInterval(schedulerHandle);
  }
  client.destroy();
  process.exit(0);
});

if (!config.token || config.token.startsWith('REPLACE')) {
  console.warn('Veuillez configurer votre token Discord dans config.js avant de lancer le bot.');
} else {
  client.login(config.token).catch((error) => {
    console.error('Impossible de se connecter à Discord:', error);
  });
}
