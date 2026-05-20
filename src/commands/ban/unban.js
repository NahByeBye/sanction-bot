const { ActionKeys } = require('../../utils/actionKeys');
const { helpEntries } = require('../definitions/helpContent');
const { cloneHelpData, replyCommandError } = require('../helpers/usageMessages');
const { buildUnbanSuccessEmbed, INTERNAL_REVOKE_REASON } = require('../../utils/sanctionSuccessEmbeds');

const help = cloneHelpData(helpEntries.unban);

module.exports = {
  prefix: { aliases: ['unban'] },
  handlePrefix: async ({ message, args, registry, sanctionService, configService }) => {
    const guild = message.guild;
    if (!guild) {
      return;
    }

    const executorMember = message.member;
    const commandPrefix = configService.getPrefix();
    const target = await registry.resolveCommandTarget(message, args);
    if (target.error) {
      await message.reply(replyCommandError(configService, target.error, commandPrefix));
      return;
    }
    const userId = target.userId;

    const guard = await registry.runActionWithGuards({
      source: message,
      actionKey: ActionKeys.UNBAN,
      commandKey: help.key,
      executorMember,
      message,
      reason: '',
    });
    if (guard.blocked) {
      return;
    }

    const targetUser = await message.client.users.fetch(userId).catch(() => null);
    if (!targetUser) {
      await message.reply(replyCommandError(configService, 'Utilisateur introuvable.', commandPrefix));
      return;
    }

    try {
      const isBanned = await guild.bans.fetch(userId).then(() => true).catch(() => false);
      
      if (!isBanned) {
        await message.reply(replyCommandError(configService, 'Cet utilisateur n\'est pas banni du serveur.', commandPrefix));
        return;
      }

      try {
        await sanctionService.unbanUser({
          guild,
          targetUser,
          executorUser: message.author,
          reason: INTERNAL_REVOKE_REASON
        });
      } catch (error) {
        if (error.message === 'Aucun ban pour cet utilisateur.') {
          await guild.bans.remove(userId, INTERNAL_REVOKE_REASON);
        } else {
          throw error;
        }
      }
      
      const embed = buildUnbanSuccessEmbed(configService, targetUser.id);
      await message.reply({ embeds: [embed] });
    } catch (error) {
      await message.reply(replyCommandError(configService, error.message, commandPrefix));
    }
  },
  actionKey: ActionKeys.UNBAN,
  help
};
