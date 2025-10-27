const { Collection, REST, Routes, SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const commandModules = require('./commandModules');
const { formatDuration } = require('../utils/time');

const DEFAULT_PARENT_DESCRIPTION = 'Commandes du bot';

const SLASH_PARENTS = {
  owner: 'Gestion des owners du bot',
  botconfig: 'Configurer le bot de sanctions'
};

class CommandRegistry {
  constructor({ client, configService, sanctionService, permissionService, cooldownService, db }) {
    this.client = client;
    this.configService = configService;
    this.sanctionService = sanctionService;
    this.permissionService = permissionService;
    this.cooldownService = cooldownService;
    this.db = db;

    this.commandModules = Array.isArray(commandModules) ? commandModules : [];

    this.slashParents = new Map();
    this.slashSubcommandMap = new Map();
    this.slashCommandBuilders = [];
    this.standaloneSlashCommands = new Map();

    this.prefixCommands = new Collection();
    this.prefixGroups = new Map();

    this.initializeSlashParents();
    this.registerModules();
  }

  initializeSlashParents() {
    for (const [name, description] of Object.entries(SLASH_PARENTS)) {
      const builder = new SlashCommandBuilder().setName(name).setDescription(description);
      this.slashParents.set(name, { builder, hasSubcommands: false, module: null });
    }
  }

  registerModules() {
    this.slashSubcommandMap.clear();
    this.standaloneSlashCommands.clear();

    const standaloneBuilders = [];

    for (const module of this.commandModules) {
      if (!module) {
        continue;
      }
      const builder = this.registerSlashModule(module);
      if (builder) {
        standaloneBuilders.push(builder);
      }
      this.registerPrefixModule(module);
    }

    const parentBuilders = Array.from(this.slashParents.values())
      .filter((entry) => entry.hasSubcommands || entry.module)
      .map((entry) => entry.builder);

    this.slashCommandBuilders = [...standaloneBuilders, ...parentBuilders];
  }

  registerSlashModule(module) {
    if (module.standaloneSlash && module.slashName) {
      const builder = new SlashCommandBuilder().setName(module.slashName);
      const description = module.slashDescription || module.description || module.help?.description || DEFAULT_PARENT_DESCRIPTION;
      builder.setDescription(description);
      if (typeof module.registerSlash === 'function') {
        module.registerSlash(builder);
      }
      this.standaloneSlashCommands.set(module.slashName, module);
      return builder;
    }

    const parentName = module.slashParent;
    if (!parentName) {
      return null;
    }

    let parentEntry = this.slashParents.get(parentName);
    if (!parentEntry) {
      const builder = new SlashCommandBuilder()
        .setName(parentName)
        .setDescription(DEFAULT_PARENT_DESCRIPTION);
      parentEntry = { builder, hasSubcommands: false, module: null };
      this.slashParents.set(parentName, parentEntry);
    }

    if (typeof module.registerSlash === 'function' && module.slashName) {
      parentEntry.builder.addSubcommand((sub) => module.registerSlash(sub));
      parentEntry.hasSubcommands = true;
      this.slashSubcommandMap.set(`${parentName}:${module.slashName}`, module);
    } else if (typeof module.handleSlash === 'function') {
      parentEntry.module = module;
    }

    return null;
  }

  registerPrefixModule(module) {
    const prefix = module.prefix;
    if (!prefix) {
      return;
    }

    if (Array.isArray(prefix.aliases)) {
      for (const alias of prefix.aliases) {
        if (typeof alias === 'string' && alias.trim().length > 0) {
          this.prefixCommands.set(alias.toLowerCase(), module);
        }
      }
    }

    if (prefix.group && Array.isArray(prefix.group.baseAliases)) {
      const triggers = Array.isArray(prefix.group.triggers) ? prefix.group.triggers : [];
      const entry = {
        module,
        triggers: triggers.map((token) => token.toLowerCase()),
        default: Boolean(prefix.group.default)
      };

      for (const baseAlias of prefix.group.baseAliases) {
        if (typeof baseAlias !== 'string' || baseAlias.trim().length === 0) {
          continue;
        }
        const key = baseAlias.toLowerCase();
        if (!this.prefixGroups.has(key)) {
          this.prefixGroups.set(key, []);
        }
        this.prefixGroups.get(key).push(entry);
      }
    }
  }

  getSlashCommandData() {
    return this.slashCommandBuilders.map((builder) => builder.toJSON());
  }

  async handleSlashInteraction(interaction) {
    let module = this.standaloneSlashCommands.get(interaction.commandName) || null;
    let parentEntry = null;

    if (!module) {
      parentEntry = this.slashParents.get(interaction.commandName);
      if (!parentEntry) {
        return;
      }

      if (parentEntry.hasSubcommands) {
        let subName;
        try {
          subName = interaction.options.getSubcommand();
        } catch (error) {
          console.error('Sous-commande invalide:', error);
          return;
        }
        module = this.slashSubcommandMap.get(`${interaction.commandName}:${subName}`) || null;
      } else {
        module = parentEntry.module;
      }
    }

    if (!module || typeof module.handleSlash !== 'function') {
      return;
    }

    if (interaction.guild && !this.permissionService.isOwner(interaction.user.id)) {
      const blacklisted = this.sanctionService.isUserBlacklisted(
        interaction.guild.id,
        interaction.user.id
      );
      if (blacklisted && interaction.commandName !== 'owner') {
        await interaction.reply({ content: 'Vous êtes blacklisté du bot.', ephemeral: true });
        return;
      }
    }

    try {
      await module.handleSlash(this.createSlashContext(interaction));
    } catch (error) {
      console.error('Erreur lors du traitement de la slash command:', error);
      if (!interaction.replied) {
        await interaction.reply({ content: 'Une erreur est survenue.', ephemeral: true }).catch(() => {});
      }
    }
  }

  async handleMessage(message) {
    if (!this.configService.arePrefixCommandsEnabled()) {
      return;
    }
    if (message.author.bot || !message.guild) {
      return;
    }

    const prefix = this.configService.getPrefix();
    if (!message.content.toLowerCase().startsWith(prefix.toLowerCase())) {
      return;
    }

    if (this.sanctionService.isUserBlacklisted(message.guild.id, message.author.id)) {
      return;
    }

    const withoutPrefix = message.content.slice(prefix.length).trim();
    if (!withoutPrefix) {
      return;
    }

    const tokens = withoutPrefix.split(/\s+/);
    const commandAlias = tokens.shift().toLowerCase();
    const args = tokens;

    const directModule = this.prefixCommands.get(commandAlias);
    if (directModule && typeof directModule.handlePrefix === 'function') {
      try {
        await directModule.handlePrefix(this.createPrefixContext(message, args));
      } catch (error) {
        console.error('Erreur lors du traitement de la commande prefix:', error);
      }
      return;
    }

    const groupedModules = this.prefixGroups.get(commandAlias);
    if (!groupedModules || groupedModules.length === 0) {
      return;
    }

    const triggerToken = args.length > 0 ? args.shift().toLowerCase() : '';
    let entry = groupedModules.find((candidate) => candidate.triggers.includes(triggerToken));

    if (!entry) {
      entry = groupedModules.find((candidate) => candidate.default);
      if (!entry) {
        await message.reply('Sous-commande inconnue.');
        return;
      }
      if (triggerToken) {
        args.unshift(triggerToken);
      }
    }

    if (typeof entry.module.handlePrefix !== 'function') {
      return;
    }

    try {
      await entry.module.handlePrefix(this.createPrefixContext(message, args));
    } catch (error) {
      console.error('Erreur lors du traitement de la commande prefix groupée:', error);
    }
  }

  createSlashContext(interaction) {
    return {
      interaction,
      registry: this,
      sanctionService: this.sanctionService,
      permissionService: this.permissionService,
      configService: this.configService,
      cooldownService: this.cooldownService,
      db: this.db,
      client: this.client
    };
  }

  createPrefixContext(message, args) {
    return {
      message,
      args,
      registry: this,
      sanctionService: this.sanctionService,
      permissionService: this.permissionService,
      configService: this.configService,
      cooldownService: this.cooldownService,
      db: this.db,
      client: this.client
    };
  }

  async runActionWithGuards({ actionKey, executorMember, interaction, message, reason, durationMs, usageHint }) {
    if (!actionKey) {
      return { blocked: false };
    }

    if (!executorMember) {
      const reply = 'Impossible de déterminer le membre exécutant.';
      if (interaction) {
        await interaction.reply({ content: reply, ephemeral: true }).catch(() => {});
      } else if (message) {
        await message.reply(reply).catch(() => {});
      }
      return { blocked: true };
    }

    const allowed = await this.permissionService.canExecute(executorMember, actionKey);
    if (!allowed) {
      const reply = "Vous n'avez pas la permission d'exécuter cette action.";
      if (interaction) {
        await interaction.reply({ content: reply, ephemeral: true }).catch(() => {});
      } else if (message) {
        await message.reply(reply).catch(() => {});
      }
      return { blocked: true };
    }

    const actionConfig = this.permissionService.getActionConfig(actionKey);
    const cooldownResult = this.cooldownService.checkAndConsume(actionKey, executorMember.id, {
      cooldownMs: actionConfig.cooldownMs,
      dailyLimit: actionConfig.dailyLimit
    });

    if (!cooldownResult.allowed) {
      const retryAfter = cooldownResult.retryAfter
        ? formatDuration(cooldownResult.retryAfter)
        : 'plus tard';
      const reply = cooldownResult.limitReached
        ? `Limite quotidienne atteinte. Réessayez dans ${retryAfter}.`
        : `Action en cooldown. Réessayez dans ${retryAfter}.`;
      if (interaction) {
        await interaction.reply({ content: reply, ephemeral: true }).catch(() => {});
      } else if (message) {
        await message.reply(reply).catch(() => {});
      }
      return { blocked: true };
    }

    if (this.configService.isReasonRequired()) {
      const hasReason = typeof reason === 'string' && reason.trim().length > 0;
      if (!hasReason) {
        const base = 'Vous devez fournir une raison valide.';
        const reply = usageHint ? `${base}\n${usageHint}` : base;
        if (interaction) {
          await interaction.reply({ content: reply, ephemeral: true }).catch(() => {});
        } else if (message) {
          await message.reply(reply).catch(() => {});
        }
        return { blocked: true };
      }
    }

    return { blocked: false, actionConfig };
  }

  async ensureOwnerPermissions(member) {
    if (!member) {
      return false;
    }
    if (this.permissionService.isOwner(member.id)) {
      return true;
    }
    return member.permissions.has(PermissionFlagsBits.Administrator);
  }

  async registerSlashCommands() {
    if (!this.configService.areSlashCommandsEnabled()) {
      return;
    }

    const token = this.configService.get('token');
    const clientId = this.configService.get('clientId');
    const guildId = this.configService.get('guildId');

    if (!clientId) {
      console.warn('clientId non défini; enregistrement des slash commands ignoré.');
      return;
    }

    if (!token || token.startsWith('REPLACE')) {
      console.warn('Token Discord invalide; enregistrement des slash commands ignoré.');
      return;
    }

    const rest = new REST({ version: '10' }).setToken(token);
    const commandsData = this.getSlashCommandData();

    if (guildId) {
      await rest.put(Routes.applicationGuildCommands(clientId, guildId), { body: commandsData });
    } else {
      await rest.put(Routes.applicationCommands(clientId), { body: commandsData });
    }
  }

  extractUserId(token) {
    if (!token) {
      return null;
    }
    const match = token.match(/^(?:<@!?(\d+)>|(\d+))$/);
    if (!match) {
      return null;
    }
    return match[1] || match[2] || null;
  }

  extractRoleId(token) {
    if (!token) {
      return null;
    }
    const match = token.match(/^(?:<@&(\d+)>|(\d+))$/);
    if (!match) {
      return null;
    }
    return match[1] || match[2] || null;
  }
}

module.exports = { CommandRegistry };
