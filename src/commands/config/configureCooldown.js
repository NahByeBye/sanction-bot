const { actionChoices } = require('./actionChoices');
const { helpEntries } = require('../definitions/helpContent');
const { cloneHelpData, buildUsageResponse } = require('../helpers/usageMessages');

const help = cloneHelpData(helpEntries.configCooldown);

module.exports = {
  slashParent: 'botconfig',
  slashName: 'cooldown',
  registerSlash: (sub) =>
    sub
      .setName('cooldown')
      .setDescription('Définir un cooldown en secondes')
      .addStringOption((option) =>
        option
          .setName('action')
          .setDescription('Action à configurer')
          .setRequired(true)
          .addChoices(...actionChoices)
      )
      .addIntegerOption((option) =>
        option.setName('secondes').setDescription('0 pour désactiver').setRequired(true)
      ),
  handleSlash: async ({ interaction, registry, permissionService }) => {
    if (!(await registry.ensureOwnerPermissions(interaction.member))) {
      await interaction.reply({ content: 'Seuls les owners ou administrateurs peuvent modifier la configuration.', ephemeral: true });
      return;
    }

    const action = interaction.options.getString('action');
    const seconds = interaction.options.getInteger('secondes');
    const current = permissionService.getActionConfig(action);
    permissionService.setActionConfig(action, {
      roleIds: current.roleIds,
      cooldownMs: Math.max(0, seconds) * 1000,
      dailyLimit: current.dailyLimit
    });
    await interaction.reply({ content: 'Cooldown mis à jour.', ephemeral: true });
  },
  prefix: {
    group: {
      baseAliases: ['config'],
      triggers: ['cooldown']
    }
  },
  handlePrefix: async ({ message, args, registry, permissionService }) => {
    if (!(await registry.ensureOwnerPermissions(message.member))) {
      await message.reply("Vous n'avez pas la permission d'utiliser cette commande.");
      return;
    }

    const action = args.shift();
    const secondsToken = args.shift();
    if (!action || typeof secondsToken === 'undefined') {
      await message.reply(buildUsageResponse('Usage incorrect.', help, 'prefix'));
      return;
    }
    const seconds = Number(secondsToken);
    const current = permissionService.getActionConfig(action);
    permissionService.setActionConfig(action, {
      roleIds: current.roleIds,
      cooldownMs: Math.max(0, seconds || 0) * 1000,
      dailyLimit: current.dailyLimit
    });
    await message.reply('Cooldown mis à jour.');
  },
  help: helpEntries.configCooldown
};
