const { helpEntries } = require('../definitions/helpContent');
const { cloneHelpData, buildUsageResponse } = require('../helpers/usageMessages');

const help = cloneHelpData(helpEntries.ownerAdd);

module.exports = {
  slashParent: 'owner',
  slashName: 'ajouter',
  registerSlash: (sub) =>
    sub
      .setName('ajouter')
      .setDescription('Ajouter un owner secondaire')
      .addUserOption((option) => option.setName('membre').setDescription('Utilisateur à ajouter').setRequired(true)),
  handleSlash: async ({ interaction, permissionService, registry }) => {
    if (!(await registry.ensureOwnerPermissions(interaction.member))) {
      await interaction.reply({ content: 'Seuls les owners ou administrateurs peuvent gérer cette commande.', ephemeral: true });
      return;
    }

    const user = interaction.options.getUser('membre');
    permissionService.addOwner(user.id, interaction.user.id, false);
    await interaction.reply({ content: `<@${user.id}> ajouté en tant qu'owner secondaire.` });
  },
  prefix: {
    group: {
      baseAliases: ['owner'],
      triggers: ['ajouter', 'add']
    }
  },
  handlePrefix: async ({ message, args, permissionService, registry }) => {
    if (!(await registry.ensureOwnerPermissions(message.member))) {
      await message.reply("Vous n'avez pas la permission d'utiliser cette commande.");
      return;
    }

    const userMention = args.shift();
    if (!userMention) {
      await message.reply(buildUsageResponse('Précisez un utilisateur.', help, 'prefix'));
      return;
    }

    const userId = registry.extractUserId(userMention);
    if (!userId) {
      await message.reply(buildUsageResponse("Impossible de déterminer l'utilisateur.", help, 'prefix'));
      return;
    }

    permissionService.addOwner(userId, message.author.id, false);
    await message.reply(`<@${userId}> est désormais owner.`);
  },
  help: helpEntries.ownerAdd
};
