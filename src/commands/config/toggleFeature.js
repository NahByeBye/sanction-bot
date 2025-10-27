const { helpEntries } = require('../definitions/helpContent');
const { cloneHelpData, buildUsageResponse } = require('../helpers/usageMessages');

const help = cloneHelpData(helpEntries.configToggle);

module.exports = {
  slashParent: 'botconfig',
  slashName: 'toggle',
  registerSlash: (sub) =>
    sub
      .setName('toggle')
      .setDescription('Activer ou désactiver une fonctionnalité')
      .addStringOption((option) =>
        option
          .setName('fonction')
          .setDescription('Fonction à modifier')
          .setRequired(true)
          .addChoices(
            { name: 'Slash commands', value: 'enableSlashCommands' },
            { name: 'Prefix commands', value: 'enablePrefixCommands' },
            { name: 'Raison obligatoire', value: 'enforceReason' }
          )
      )
      .addBooleanOption((option) => option.setName('valeur').setDescription('Nouvelle valeur').setRequired(true)),
  handleSlash: async ({ interaction, registry, configService }) => {
    if (!(await registry.ensureOwnerPermissions(interaction.member))) {
      await interaction.reply({ content: 'Seuls les owners ou administrateurs peuvent modifier la configuration.', ephemeral: true });
      return;
    }

    const feature = interaction.options.getString('fonction');
    const value = interaction.options.getBoolean('valeur');
    configService.set(feature, value);
    await interaction.reply({ content: `Configuration mise à jour: ${feature} = ${value ? 'activé' : 'désactivé'}.`, ephemeral: true });
  },
  prefix: {
    group: {
      baseAliases: ['config'],
      triggers: ['toggle']
    }
  },
  handlePrefix: async ({ message, args, registry, configService }) => {
    if (!(await registry.ensureOwnerPermissions(message.member))) {
      await message.reply("Vous n'avez pas la permission d'utiliser cette commande.");
      return;
    }

    const key = args.shift();
    const value = args.shift();
    if (!key || typeof value === 'undefined') {
      await message.reply(buildUsageResponse('Usage incorrect.', help, 'prefix'));
      return;
    }
    const boolValue = value === 'on' || value === 'true';
    configService.set(key, boolValue);
    await message.reply(`Configuration mise à jour: ${key} = ${boolValue}`);
  },
  help: helpEntries.configToggle
};
