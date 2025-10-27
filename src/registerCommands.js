const config = require('../config');
const { DatabaseManager } = require('./database/DatabaseManager');
const { ConfigService } = require('./services/configService');
const { PermissionService } = require('./services/permissionService');
const { CooldownService } = require('./services/cooldownService');
const { SanctionService } = require('./services/sanctionService');
const { CommandRegistry } = require('./commands/commandRegistry');

(async () => {
  const db = new DatabaseManager(config.databasePath, config.ownerId);
  const configService = new ConfigService(db, config);
  const permissionService = new PermissionService(db, configService);
  const cooldownService = new CooldownService(db);
  const fakeClient = { guilds: { cache: new Map() }, users: { fetch: async () => null } };
  const sanctionService = new SanctionService({ db, configService, client: fakeClient });
  const commandRegistry = new CommandRegistry({
    client: fakeClient,
    configService,
    sanctionService,
    permissionService,
    cooldownService,
    db
  });

  try {
    await commandRegistry.registerSlashCommands();
    console.log('Slash commands synchronisées.');
  } catch (error) {
    console.error('Erreur lors de la synchronisation des slash commands:', error);
  } finally {
    process.exit(0);
  }
})();
