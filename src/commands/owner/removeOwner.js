const { helpEntries } = require('../definitions/helpContent');
const { cloneHelpData, buildUsageResponse } = require('../helpers/usageMessages');

const help = cloneHelpData(helpEntries.ownerRemove);

module.exports = {
  slashParent: 'owner',
  slashName: 'retirer',
  registerSlash: (sub) =>
    sub
      .setName('retirer')
      .setDescription('Retirer un owner secondaire')
      .addUserOption((option) => option.setName('membre').setDescription('Utilisateur à retirer').setRequired(true)),
  handleSlash: async ({ interaction, permissionService, registry, configService }) => {
    if (!(await registry.ensureOwnerPermissions(interaction.member))) {
      await interaction.reply({ content: 'Seuls les owners ou administrateurs peuvent gérer cette commande.', ephemeral: true });
      return;
    }

    const user = interaction.options.getUser('membre');
    if (user.id === configService.get('ownerId')) {
      await interaction.reply({ content: "Impossible de retirer l'owner principal.", ephemeral: true });
      return;
    }
    permissionService.removeOwner(user.id);
    await interaction.reply({ content: `<@${user.id}> retiré des owners.` });
  },
  prefix: {
    group: {
      baseAliases: ['owner'],
      triggers: ['retirer', 'remove']
    }
  },
  handlePrefix: async ({ message, args, permissionService, registry, configService }) => {
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
    if (!userId || userId === configService.get('ownerId')) {
      await message.reply(buildUsageResponse("Impossible de retirer cet utilisateur.", help, 'prefix'));
      return;
    }

    permissionService.removeOwner(userId);
    await message.reply(`<@${userId}> n'est plus owner.`);
  },
  help: helpEntries.ownerRemove
};
