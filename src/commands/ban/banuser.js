const { ActionKeys } = require('../../utils/actionKeys');
const { helpEntries } = require('../definitions/helpContent');
const { cloneHelpData, replyCommandError } = require('../helpers/usageMessages');
const { sendUserSanctionList } = require('../../utils/userSanctionListHelpers');

const help = cloneHelpData(helpEntries.banuser || {
  key: 'banuser',
  label: 'Ban User History',
  category: 'sanctions',
  description: 'Afficher les bans effectués par un utilisateur',
  usage: { prefix: '&banuser <utilisateur>' },
  examples: { prefix: '&banuser @utilisateur' }
});

module.exports = {
  prefix: { aliases: ['banuser'] },
  handlePrefix: async ({ message, args, registry, db, configService }) => {
    const guild = message.guild;
    if (!guild) {
      return;
    }

    const executorMember = message.member;
    const commandPrefix = configService.getPrefix();
    
    let executorId;
    if (args.length === 0) {
      executorId = message.author.id;
    } else {
      const target = await registry.resolveCommandTarget(message, args);
      if (target.error) {
        await message.reply(replyCommandError(configService, target.error, commandPrefix));
        return;
      }
      executorId = target.userId;
    }

    const canBan = await registry.permissionService.canExecute(executorMember, ActionKeys.BAN);
    const canBlacklist = await registry.permissionService.canExecute(executorMember, ActionKeys.BLACKLIST);

    if (!canBan && !canBlacklist && !registry.permissionService.isOwner(executorMember.id)) {
      await message.reply(replyCommandError(configService, "Vous n'avez pas la permission d'exécuter cette action", commandPrefix));
      return;
    }

    const targetUser = await message.client.users.fetch(executorId).catch(() => null);
    if (!targetUser) {
      await message.reply(replyCommandError(configService, 'Utilisateur introuvable.', commandPrefix));
      return;
    }

    try {
      const sanctions = db.listSanctionsByExecutor(guild.id, executorId, ['BAN', 'TEMPBAN']);
      
      if (sanctions.length === 0) {
        const embed = {
          color: parseInt(configService.get('color').replace('#', ''), 16),
          description: `✗ Aucun ban effectué par ${targetUser.username}.`
        };
        await message.reply({ embeds: [embed] });
        return;
      }

      await sendUserSanctionList({
        message,
        sanctions,
        targetUser,
        sanctionType: 'Bans',
        configService
      });
    } catch (error) {
      await message.reply(replyCommandError(configService, error.message, commandPrefix));
    }
  },
  actionKey: null,
  help
};
