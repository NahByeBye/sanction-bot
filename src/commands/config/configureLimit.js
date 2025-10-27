const { actionChoices } = require('./actionChoices');
const { helpEntries } = require('../definitions/helpContent');
const { cloneHelpData, buildUsageResponse } = require('../helpers/usageMessages');

const help = cloneHelpData(helpEntries.configLimit);

module.exports = {
  slashParent: 'botconfig',
  slashName: 'limite',
  registerSlash: (sub) =>
    sub
      .setName('limite')
      .setDescription("Définir la limite quotidienne d'utilisation")
      .addStringOption((option) =>
        option
          .setName('action')
          .setDescription('Action à configurer')
          .setRequired(true)
          .addChoices(...actionChoices)
      )
      .addIntegerOption((option) =>
        option.setName('nombre').setDescription('0 pour désactiver la limite').setRequired(true)
      ),
  handleSlash: async ({ interaction, registry, permissionService }) => {
    if (!(await registry.ensureOwnerPermissions(interaction.member))) {
      await interaction.reply({ content: 'Seuls les owners ou administrateurs peuvent modifier la configuration.', ephemeral: true });
      return;
    }

    const action = interaction.options.getString('action');
    const count = interaction.options.getInteger('nombre');
    const current = permissionService.getActionConfig(action);
    permissionService.setActionConfig(action, {
      roleIds: current.roleIds,
      cooldownMs: current.cooldownMs,
      dailyLimit: count <= 0 ? null : count
    });
    await interaction.reply({ content: 'Limite mise à jour.', ephemeral: true });
  },
  prefix: {
    group: {
      baseAliases: ['config'],
      triggers: ['limit', 'limite']
    }
  },
  handlePrefix: async ({ message, args, registry, permissionService }) => {
    if (!(await registry.ensureOwnerPermissions(message.member))) {
      await message.reply("Vous n'avez pas la permission d'utiliser cette commande.");
      return;
    }

    const action = args.shift();
    const countToken = args.shift();
    if (!action || typeof countToken === 'undefined') {
      await message.reply(buildUsageResponse('Usage incorrect.', help, 'prefix'));
      return;
    }
    const count = countToken === 'reset' ? null : Number(countToken);
    const current = permissionService.getActionConfig(action);
    permissionService.setActionConfig(action, {
      roleIds: current.roleIds,
      cooldownMs: current.cooldownMs,
      dailyLimit: !count || count <= 0 ? null : count
    });
    await message.reply('Limite mise à jour.');
  },
  help: helpEntries.configLimit
};
