const { helpEntries } = require('../definitions/helpContent');
const {
  startCategorizedSanctionFlowFromMessage
} = require('../helpers/categorizedSanctionFlow');

const ensureGuildAndPermission = async ({ guild, member, userId, registry, reply }) => {
  if (!guild) {
    await reply('Cette commande doit être utilisée dans un serveur.');
    return false;
  }

  const canExecute = await registry.permissionService.canExecute(member, 'sanction:tempmute');
  if (!canExecute && !registry.permissionService.isOwner(userId)) {
    await reply("Vous n'avez pas la permission d'utiliser cette commande.");
    return false;
  }

  return true;
};

module.exports = {
  prefix: {
    aliases: ['tempmute', 'tm']
  },
  handlePrefix: async ({ message, args, registry, configService, sanctionService }) => {
    const allowed = await ensureGuildAndPermission({
      guild: message.guild,
      member: message.member,
      userId: message.author.id,
      registry,
      reply: (content) => message.reply(content)
    });
    if (!allowed) {
      return;
    }

    const target = await registry.resolveCommandTarget(message, args);
    if (target.error) {
      const { replyCommandError } = require('../helpers/usageMessages');
      await message.reply(replyCommandError(configService, target.error, configService.getPrefix()));
      return;
    }
    const userId = target.userId;

    const targetUser = await message.client.users.fetch(userId).catch(() => null);
    if (!targetUser) {
      await message.reply('Utilisateur introuvable.');
      return;
    }

    await startCategorizedSanctionFlowFromMessage({
      message,
      configService,
      targetUser,
      flowPrefix: 'tempmute',
      sanctionService
    });
  },
  help: helpEntries.tempmute
};
