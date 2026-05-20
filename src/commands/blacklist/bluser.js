const { ActionKeys } = require('../../utils/actionKeys');
const { helpEntries } = require('../definitions/helpContent');
const { cloneHelpData, replyCommandError } = require('../helpers/usageMessages');
const { sendUserSanctionList } = require('../../utils/userSanctionListHelpers');

const help = cloneHelpData(helpEntries.bluser || {
  key: 'bluser',
  label: 'Blacklist User History',
  category: 'sanctions',
  description: 'Afficher les blacklist effectuées par un utilisateur',
  usage: { prefix: '&bluser <utilisateur>' },
  examples: { prefix: '&bluser @utilisateur' }
});

module.exports = {
  prefix: { aliases: ['bluser'] },
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

    const canBlacklist = await registry.permissionService.canExecute(executorMember, ActionKeys.BLACKLIST);

    if (!canBlacklist && !registry.permissionService.isOwner(executorMember.id)) {
      await message.reply(replyCommandError(configService, "Vous n'avez pas la permission d'exécuter cette action", commandPrefix));
      return;
    }

    const targetUser = await message.client.users.fetch(executorId).catch(() => null);
    if (!targetUser) {
      await message.reply(replyCommandError(configService, 'Utilisateur introuvable.', commandPrefix));
      return;
    }

    try {
      const sanctions = db.listSanctionsByExecutor(guild.id, executorId, ['BLACKLIST', 'TEMPBLACKLIST']);
      
      if (sanctions.length === 0) {
        const embed = {
          color: parseInt(configService.get('color').replace('#', ''), 16),
          description: `✗ Aucune blacklist effectuée par ${targetUser.username}.`
        };
        await message.reply({ embeds: [embed] });
        return;
      }

      await sendUserSanctionList({
        message,
        sanctions,
        targetUser,
        sanctionType: 'Blacklists',
        configService
      });
    } catch (error) {
      await message.reply(replyCommandError(configService, error.message, commandPrefix));
    }
  },
  actionKey: null,
  help
};
