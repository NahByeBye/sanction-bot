const { buildEmbed } = require('../../utils/embedFactory');
const { discordTimestamp } = require('../../utils/time');

const buildOwnersEmbed = (configService, permissionService) => {
  const owners = permissionService.listOwners();
  const description = owners.length > 0
    ? owners
        .map((owner) =>
          `${owner.is_primary ? '' : '•'} <@${owner.user_id}> — ajouté ${discordTimestamp(owner.added_at, 'R')}`
        )
        .join('\n')
    : 'Aucun owner enregistré.';

  return buildEmbed(configService, {
    title: 'Owners du bot',
    description
  });
};

module.exports = {
  prefix: {
    aliases: ['owner']
  },
  handlePrefix: async ({ message, args, permissionService, registry, configService }) => {
    if (!(await registry.ensureOwnerPermissions(message.member))) {
      await message.reply("Vous n'avez pas la permission d'utiliser cette commande.");
      return;
    }

    const targetToken = args[0];
    if (!targetToken) {
      await message.reply({ embeds: [buildOwnersEmbed(configService, permissionService)] });
      return;
    }

    const userId = registry.extractUserId(targetToken);
    if (!userId) {
      await message.reply('ID ou mention invalide.');
      return;
    }

    const primaryOwnerId = configService.get('ownerId');
    if (userId === primaryOwnerId) {
      await message.reply("L'owner principal ne peut pas être retiré via cette commande.");
      return;
    }

    if (permissionService.isOwner(userId)) {
      permissionService.removeOwner(userId);
      await message.reply(`<@${userId}> n'est plus owner.`);
      return;
    }

    permissionService.addOwner(userId, message.author.id, false);
    await message.reply(`<@${userId}> est désormais owner.`);
  },
  help: {
    key: 'owner',
    label: 'Owner',
    category: 'owners',
    description: 'Liste les owners ou bascule le statut owner d’un utilisateur.',
    usage: { prefix: '&owner [id|@utilisateur]' },
    examples: { prefix: '&owner @Staff' },
    notes: ['Sans argument : affiche la liste.', 'Avec un ID : ajoute ou retire (toggle).']
  }
};
