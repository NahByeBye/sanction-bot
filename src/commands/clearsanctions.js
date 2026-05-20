const { ActionKeys } = require('../utils/actionKeys');

const { helpEntries } = require('./definitions/helpContent');

const { cloneHelpData, replyCommandError } = require('./helpers/usageMessages');

const { buildClearSanctionsSuccessEmbed } = require('../utils/sanctionSuccessEmbeds');



const help = cloneHelpData(helpEntries.clearsanctions);



module.exports = [
  {
    prefix: {
      aliases: ['clear-sanctions', 'clearsanctions', 'clearsanction']
    },
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

      const rawReason = args.join(' ');
      const guard = await registry.runActionWithGuards({
        source: message,
        actionKey: ActionKeys.CLEAR_SANCTIONS,
        executorMember,
        message,
        reason: rawReason
      });

      if (guard.blocked) {
        return;
      }

      const targetUser = await message.client.users.fetch(userId).catch(() => null);
      if (!targetUser) {
        await message.reply(replyCommandError(configService, 'Utilisateur introuvable.', commandPrefix));
        return;
      }

      const reason = rawReason || 'Aucune raison fournie';

      try {
        const clearedIds = await sanctionService.clearSanctions({
          guild,
          targetUser,
          executorUser: message.author,
          reason,
          typeFilter: null,
          includeRevoked: true
        });

        if (clearedIds.length === 0) {
          await message.reply('Aucune sanction trouvée pour cet utilisateur.');
          return;
        }

        const embed = buildClearSanctionsSuccessEmbed(
          configService,
          targetUser.id,
          clearedIds.length,
          reason
        );
        await message.reply({ embeds: [embed] });
      } catch (error) {
        await message.reply(replyCommandError(configService, error.message, commandPrefix));
      }
    },
    actionKey: ActionKeys.CLEAR_SANCTIONS,
    help
  }
];

