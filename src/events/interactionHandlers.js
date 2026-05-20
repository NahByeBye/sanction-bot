const { Events, MessageFlags, ActionRowBuilder } = require('discord.js');
const { assertMessageInvoker } = require('../utils/interactionGuard');
const { handleCategorizedSanctionInteraction } = require('../commands/helpers/categorizedSanctionFlow');
const { parseUserSanctionListButtonId, buildUserSanctionListEmbed, buildUserSanctionPaginationRow, ITEMS_PER_PAGE } = require('../utils/userSanctionListHelpers');
const { handleBlacklistListPagination } = require('../utils/blacklistListHelpers');
const { decodeActionId, buildBotconfigMainEmbed, buildBotconfigMainComponents } = require('../utils/botconfigHelpers');
const { buildEmbed } = require('../utils/embedFactory');
const backupCommand = require('../commands/owner/backup');
const listSanctions = require('../commands/history/listSanctions');

const setupInteractionHandlers = (client, commandRegistry, sanctionService, configService, permissionService, db) => {
  
  client.on(Events.InteractionCreate, async (interaction) => {
    if (interaction.isButton()) {
      if (!(await assertMessageInvoker(interaction))) {
        return;
      }

      const customId = interaction.customId;

      if (customId.startsWith('backup_') && typeof backupCommand.handleBackupInteraction === 'function') {
        const handled = await backupCommand.handleBackupInteraction(interaction, {
          registry: commandRegistry,
          backupService: commandRegistry.backupService,
          configService
        });
        if (handled) {
          return;
        }
      }

      if (customId === 'listprev' || customId === 'listnext') {
        if (typeof listSanctions.handlePagination === 'function') {
          await listSanctions.handlePagination({
            interaction,
            registry: commandRegistry,
            sanctionService,
            configService
          });
        }
        return;
      }

      if (customId.startsWith('bl_list:')) {
        await handleBlacklistListPagination({
          interaction,
          sanctionService,
          configService
        });
        return;
      }

      if (customId.startsWith('user_sanction_list:')) {
        const parsed = parseUserSanctionListButtonId(customId);
        if (!parsed) {
          return;
        }

        if (interaction.user.id !== parsed.executorId) {
          await interaction.reply({
            content: 'Seul l\'utilisateur qui a exécuté cette commande peut utiliser la pagination.',
            ephemeral: true
          }).catch(() => {});
          return;
        }

        const message = interaction.message;
        const embed = message.embeds[0];
        if (!embed) {
          return;
        }

        const title = embed.title;
        const match = title.match(/^(Bans|Blacklists) de (.+) \((\d+)\)$/);
        if (!match) {
          return;
        }

        const sanctionType = match[1];
        const targetUsername = match[2];
        const total = parseInt(match[3], 10);

        const totalPages = Math.max(1, Math.ceil(total / ITEMS_PER_PAGE));
        let page = parsed.page;
        if (parsed.direction === 'prev') {
          page -= 1;
        } else {
          page += 1;
        }
        page = Math.min(Math.max(page, 1), totalPages);

        const targetUser = await client.users.fetch(interaction.message.mentions.users.first()?.id || interaction.user.id).catch(() => null);
        if (!targetUser) {
          return;
        }

        const sanctionTypes = sanctionType === 'Bans' ? ['BAN', 'TEMPBAN'] : ['BLACKLIST', 'TEMPBLACKLIST'];
        const sanctions = db.listSanctionsByExecutor(interaction.guild.id, targetUser.id, sanctionTypes);

        const newEmbed = buildUserSanctionListEmbed(configService, sanctions, targetUser, sanctionType, page);
        const row = buildUserSanctionPaginationRow(parsed.executorId, page, totalPages);

        await interaction.update({
          embeds: [newEmbed],
          components: row ? [row] : []
        });
        return;
      }

      if (customId.startsWith('botconfig_limit_reset_')) {
        const encodedAction = customId.replace('botconfig_limit_reset_', '');
        const action = decodeActionId(encodedAction);
        if (!action) {
          await interaction.reply({ content: 'Action invalide.', flags: MessageFlags.Ephemeral });
          return;
        }

        const current = permissionService.getActionConfig(action);
        permissionService.setActionConfig(action, {
          roleIds: current.roleIds,
          cooldownMs: current.cooldownMs,
          dailyLimit: null,
          limitWindowSeconds: current.limitWindowSeconds
        });

        await interaction.update({
          embeds: [buildBotconfigMainEmbed(configService, `Limite supprimée pour **${action}** (aucune limite).`)],
          components: buildBotconfigMainComponents()
        });
        return;
      }

      if (customId.startsWith('botconfig_limit_unit_')) {
        const parts = customId.split('_');
        const unitSeconds = Number(parts[3]);
        const encodedAction = parts.slice(4).join('_');
        const action = decodeActionId(encodedAction);

        if (!action || ![60, 3600, 86400].includes(unitSeconds)) {
          await interaction.reply({ content: 'Sélection invalide.', flags: MessageFlags.Ephemeral });
          return;
        }

        const unitLabel = unitSeconds === 60 ? 'minutes' : unitSeconds === 3600 ? 'heures' : 'jours';
        const { ModalBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');

        const modal = new ModalBuilder()
          .setCustomId(`botconfig_limit_modal_${unitSeconds}_${encodedAction}`)
          .setTitle('Configuration de limite');

        const limitInput = new TextInputBuilder()
          .setCustomId('limit')
          .setLabel('Nombre d\'utilisations')
          .setStyle(TextInputStyle.Short)
          .setPlaceholder('Par exemple : 3')
          .setRequired(true);

        const windowInput = new TextInputBuilder()
          .setCustomId('window')
          .setLabel(`Fenêtre en ${unitLabel}`)
          .setStyle(TextInputStyle.Short)
          .setPlaceholder(unitSeconds === 60 ? '20 pour 20 minutes' : unitSeconds === 3600 ? '2 pour 2 heures' : '2 pour 2 jours')
          .setRequired(true);

        modal.addComponents(
          new ActionRowBuilder().addComponents(limitInput),
          new ActionRowBuilder().addComponents(windowInput)
        );

        await interaction.showModal(modal);
        return;
      }

      if (customId.startsWith('botconfig_action_')) {
        const encodedAction = customId.replace('botconfig_action_', '');
        const action = decodeActionId(encodedAction);
        if (!action) {
          await interaction.reply({ content: 'Action invalide.', flags: MessageFlags.Ephemeral });
          return;
        }

        const {
          buildActionSelectEmbed,
          buildToggleSelectionEmbed,
          buildReasonCategoryEmbed,
          buildReasonGlobalEmbed,
          buildCommandReasonEmbed,
          buildConfirmationEmbed,
          buildLimitConfigEmbed,
          buildTimeUnitButtons,
          buildLimitConfigComponents
        } = require('../utils/botconfigHelpers');

        const current = permissionService.getActionConfig(action);
        await interaction.update({
          embeds: [buildActionSelectEmbed(configService, action)],
          components: buildBotconfigMainComponents()
        });
        return;
      }

      if (customId.startsWith('botconfig_toggle_')) {
        const parts = customId.split('_');
        const toggle = parts[2];
        const encodedAction = parts.slice(3).join('_');
        const action = decodeActionId(encodedAction);

        if (!action || !['cooldown', 'limit', 'reason'].includes(toggle)) {
          await interaction.reply({ content: 'Sélection invalide.', flags: MessageFlags.Ephemeral });
          return;
        }

        const {
          buildToggleSelectionEmbed,
          buildReasonCategoryEmbed,
          buildReasonGlobalEmbed,
          buildCommandReasonEmbed,
          buildConfirmationEmbed,
          buildLimitConfigEmbed,
          buildTimeUnitButtons,
          buildLimitConfigComponents
        } = require('../utils/botconfigHelpers');

        const current = permissionService.getActionConfig(action);
        const embeds = {
          cooldown: buildToggleSelectionEmbed(configService, action, 'cooldown', current.cooldownMs),
          limit: buildToggleSelectionEmbed(configService, action, 'limit', current.dailyLimit),
          reason: buildReasonCategoryEmbed(configService, action)
        };

        await interaction.update({
          embeds: [embeds[toggle]],
          components: buildBotconfigMainComponents()
        });
        return;
      }

      if (customId.startsWith('botconfig_reason_cat_')) {
        const parts = customId.split('_');
        const category = parts[4];
        const encodedAction = parts.slice(5).join('_');
        const action = decodeActionId(encodedAction);

        if (!action || !['global', 'command'].includes(category)) {
          await interaction.reply({ content: 'Catégorie invalide.', flags: MessageFlags.Ephemeral });
          return;
        }

        const {
          buildReasonGlobalEmbed,
          buildCommandReasonEmbed,
          buildConfirmationEmbed
        } = require('../utils/botconfigHelpers');

        const embeds = {
          global: buildReasonGlobalEmbed(configService, action),
          command: buildCommandReasonEmbed(configService, action)
        };

        await interaction.update({
          embeds: [embeds[category]],
          components: buildBotconfigMainComponents()
        });
        return;
      }

      if (customId.startsWith('botconfig_reason_set_')) {
        const parts = customId.split('_');
        const category = parts[4];
        const encodedAction = parts.slice(5).join('_');
        const action = decodeActionId(encodedAction);

        if (!action || !['global', 'command'].includes(category)) {
          await interaction.reply({ content: 'Catégorie invalide.', flags: MessageFlags.Ephemeral });
          return;
        }

        const { ModalBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');
        const modal = new ModalBuilder()
          .setCustomId(`botconfig_reason_modal_${category}_${encodedAction}`)
          .setTitle('Configuration de la raison');

        const reasonInput = new TextInputBuilder()
          .setCustomId('reason')
          .setLabel('Raison requise')
          .setStyle(TextInputStyle.Short)
          .setPlaceholder('Par exemple : Raison obligatoire pour cette action')
          .setRequired(true);

        modal.addComponents(new ActionRowBuilder().addComponents(reasonInput));
        await interaction.showModal(modal);
        return;
      }

      if (customId.startsWith('botconfig_limit_time_')) {
        const parts = customId.split('_');
        const unitSeconds = Number(parts[4]);
        const encodedAction = parts.slice(5).join('_');
        const action = decodeActionId(encodedAction);

        if (!action || ![60, 3600, 86400].includes(unitSeconds)) {
          await interaction.reply({ content: 'Unité invalide.', flags: MessageFlags.Ephemeral });
          return;
        }

        const {
          buildLimitConfigEmbed,
          buildTimeUnitButtons,
          buildLimitConfigComponents
        } = require('../utils/botconfigHelpers');

        const unitLabel = unitSeconds === 60 ? 'minutes' : unitSeconds === 3600 ? 'heures' : 'jours';
        const current = permissionService.getActionConfig(action);

        await interaction.update({
          embeds: [buildLimitConfigEmbed(configService, action, unitLabel, current)],
          components: buildLimitConfigComponents(action, unitSeconds, encodedAction)
        });
        return;
      }

      if (customId === 'botconfig_back') {
        await interaction.update({
          embeds: [buildBotconfigMainEmbed(configService)],
          components: buildBotconfigMainComponents()
        });
        return;
      }

      if (customId.startsWith('categorized_sanction_')) {
        await handleCategorizedSanctionInteraction(interaction, {
          registry: commandRegistry,
          sanctionService,
          configService
        });
        return;
      }
    }
  });

  client.on(Events.InteractionCreate, async (interaction) => {
    if (!interaction.isStringSelectMenu() && !interaction.isRoleSelectMenu()) {
      return;
    }

    if (interaction.customId === 'botconfig_action_select') {
      const action = interaction.values[0];
      if (!action) {
        await interaction.reply({ content: 'Action invalide.', flags: MessageFlags.Ephemeral });
        return;
      }

      const { buildActionSelectEmbed } = require('../utils/botconfigHelpers');
      await interaction.update({
        embeds: [buildActionSelectEmbed(configService, action)],
        components: buildBotconfigMainComponents()
      });
      return;
    }

    if (interaction.customId === 'botconfig_role_select') {
      const roleIds = interaction.values;
      const action = interaction.message.embeds[0].title.match(/Configuration : (.+)/)?.[1];
      if (!action) {
        await interaction.reply({ content: 'Action introuvable.', flags: MessageFlags.Ephemeral });
        return;
      }

      const current = permissionService.getActionConfig(action);
      permissionService.setActionConfig(action, {
        roleIds: roleIds,
        cooldownMs: current.cooldownMs,
        dailyLimit: current.dailyLimit,
        limitWindowSeconds: current.limitWindowSeconds
      });

      await interaction.update({
        embeds: [buildActionSelectEmbed(configService, action)],
        components: buildBotconfigMainComponents()
      });
      return;
    }
  });

  client.on(Events.InteractionCreate, async (interaction) => {
    if (!interaction.isModalSubmit()) {
      return;
    }

    if (interaction.customId.startsWith('botconfig_limit_modal_')) {
      const parts = interaction.customId.split('_');
      const unitSeconds = Number(parts[3]);
      const encodedAction = parts.slice(4).join('_');
      const action = decodeActionId(encodedAction);

      const limit = interaction.fields.getTextInputValue('limit');
      const window = interaction.fields.getTextInputValue('window');

      const dailyLimit = parseInt(limit, 10);
      const limitWindowSeconds = parseInt(window, 10) * unitSeconds;

      if (isNaN(dailyLimit) || isNaN(limitWindowSeconds)) {
        await interaction.reply({ content: 'Valeurs invalides.', flags: MessageFlags.Ephemeral });
        return;
      }

      const current = permissionService.getActionConfig(action);
      permissionService.setActionConfig(action, {
        roleIds: current.roleIds,
        cooldownMs: current.cooldownMs,
        dailyLimit: dailyLimit > 0 ? dailyLimit : null,
        limitWindowSeconds
      });

      await interaction.update({
        embeds: [buildBotconfigMainEmbed(configService, `Limite configurée pour **${action}** : ${dailyLimit} utilisations par ${limitWindowSeconds / unitSeconds} ${unitSeconds === 60 ? 'minute(s)' : unitSeconds === 3600 ? 'heure(s)' : 'jour(s)'}.`)],
        components: buildBotconfigMainComponents()
      });
      return;
    }

    if (interaction.customId.startsWith('botconfig_reason_modal_')) {
      const parts = interaction.customId.split('_');
      const category = parts[4];
      const encodedAction = parts.slice(5).join('_');
      const action = decodeActionId(encodedAction);

      const reason = interaction.fields.getTextInputValue('reason');
      const current = permissionService.getActionConfig(action);

      if (category === 'global') {
        permissionService.setActionConfig(action, {
          roleIds: current.roleIds,
          cooldownMs: current.cooldownMs,
          dailyLimit: current.dailyLimit,
          limitWindowSeconds: current.limitWindowSeconds,
          requireReason: true,
          reasonRequired: reason
        });
      } else {
        permissionService.setActionConfig(action, {
          roleIds: current.roleIds,
          cooldownMs: current.cooldownMs,
          dailyLimit: current.dailyLimit,
          limitWindowSeconds: current.limitWindowSeconds,
          requireReason: true,
          reasonRequired: reason
        });
      }

      await interaction.update({
        embeds: [buildBotconfigMainEmbed(configService, `Raison configurée pour **${action}** (${category}).`)],
        components: buildBotconfigMainComponents()
      });
      return;
    }
  });

  client.on(Events.InteractionCreate, async (interaction) => {
    if (!interaction.isChatInputCommand()) {
      return;
    }

    await commandRegistry.handleSlashInteraction(interaction);
  });
};

module.exports = { setupInteractionHandlers };
