const { actionChoices } = require('./actionChoices');
const { helpEntries } = require('../definitions/helpContent');
const { cloneHelpData, buildUsageResponse } = require('../helpers/usageMessages');

const help = cloneHelpData(helpEntries.configRoles);

module.exports = {
  slashParent: 'botconfig',
  slashName: 'roles',
  registerSlash: (sub) => {
    sub
      .setName('roles')
      .setDescription('Définir les rôles autorisés pour une action')
      .addStringOption((option) =>
        option
          .setName('action')
          .setDescription('Action à configurer')
          .setRequired(true)
          .addChoices(...actionChoices)
      )
      .addStringOption((option) =>
        option
          .setName('mode')
          .setDescription('Définir ou vider les rôles')
          .setRequired(true)
          .addChoices(
            { name: 'Définir', value: 'set' },
            { name: 'Vider', value: 'clear' }
          )
      );
    for (let i = 1; i <= 5; i += 1) {
      sub.addRoleOption((option) => option.setName(`role${i}`).setDescription(`Rôle ${i}`).setRequired(false));
    }
    return sub;
  },
  handleSlash: async ({ interaction, registry, permissionService }) => {
    if (!(await registry.ensureOwnerPermissions(interaction.member))) {
      await interaction.reply({ content: 'Seuls les owners ou administrateurs peuvent modifier la configuration.', ephemeral: true });
      return;
    }

    const action = interaction.options.getString('action');
    const mode = interaction.options.getString('mode');

    if (mode === 'clear') {
      const current = permissionService.getActionConfig(action);
      permissionService.setActionConfig(action, {
        roleIds: [],
        cooldownMs: current.cooldownMs,
        dailyLimit: current.dailyLimit
      });
      await interaction.reply({ content: 'Rôles réinitialisés pour cette action.', ephemeral: true });
      return;
    }

    const roleIds = [];
    for (let i = 1; i <= 5; i += 1) {
      const role = interaction.options.getRole(`role${i}`);
      if (role) {
        roleIds.push(role.id);
      }
    }

    if (roleIds.length === 0) {
      await interaction.reply({ content: buildUsageResponse('Veuillez préciser au moins un rôle.', help, 'slash'), ephemeral: true });
      return;
    }

    const current = permissionService.getActionConfig(action);
    permissionService.setActionConfig(action, {
      roleIds,
      cooldownMs: current.cooldownMs,
      dailyLimit: current.dailyLimit
    });
    await interaction.reply({ content: 'Rôles mis à jour pour cette action.', ephemeral: true });
  },
  prefix: {
    group: {
      baseAliases: ['config'],
      triggers: ['roles']
    }
  },
  handlePrefix: async ({ message, args, registry, permissionService }) => {
    if (!(await registry.ensureOwnerPermissions(message.member))) {
      await message.reply("Vous n'avez pas la permission d'utiliser cette commande.");
      return;
    }

    const action = args.shift();
    if (!action) {
      await message.reply(buildUsageResponse('Usage incorrect.', help, 'prefix'));
      return;
    }

    const roleIds = args
      .map((token) => registry.extractRoleId(token))
      .filter(Boolean);

    const current = permissionService.getActionConfig(action);
    permissionService.setActionConfig(action, {
      roleIds,
      cooldownMs: current.cooldownMs,
      dailyLimit: current.dailyLimit
    });
    await message.reply('Rôles mis à jour.');
  },
  help: helpEntries.configRoles
};
