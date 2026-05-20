const { ActionKeys, SanctionTypes } = require('../../utils/actionKeys');
const { helpEntries } = require('../definitions/helpContent');
const { cloneHelpData, replyCommandError } = require('../helpers/usageMessages');
const { buildEmbed } = require('../../utils/embedFactory');
const { buildUnmuteSuccessEmbed } = require('../../utils/sanctionSuccessEmbeds');

const help = cloneHelpData(helpEntries.unmute);
help.key = 'unto';
help.label = 'Unto';
help.description = 'Retirer le timeout d\'un membre';
help.usage.prefix = '&unto @utilisateur';
help.examples.prefix = '&unto @Mina';

const INTERNAL_REVOKE_REASON = 'Levée manuelle';

module.exports = {
  description: 'Retirer le timeout d\'un membre',
  actionKey: ActionKeys.UNMUTE,
  prefix: {
    aliases: ['unto']
  },
  help,
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
      actionKey: ActionKeys.UNMUTE,
      commandKey: help.key,
      executorMember,
      message,
      reason: ''
    });

    if (guard.blocked) {
      return;
    }

    const targetUser = await message.client.users.fetch(userId).catch(() => null);
    if (!targetUser) {
      await message.reply(replyCommandError(configService, 'Utilisateur introuvable.', commandPrefix));
      return;
    }

    const sanction = sanctionService.findActiveSanction(guild.id, userId, [SanctionTypes.TEMPMUTE]);
    if (!sanction) {
      await message.reply(replyCommandError(configService, "Cet utilisateur n'est pas Timeout.", commandPrefix));
      return;
    }

    const events = sanctionService.getSanctionEvents(sanction.id);
    const appliedEvent = events.find(e => e.action === 'APPLIED');
    let isTimeout = false;
    if (appliedEvent?.metadata) {
      try {
        const meta = JSON.parse(appliedEvent.metadata);
        isTimeout = meta.muteMethod === 'timeout';
      } catch (e) {
      }
    }

    if (!isTimeout) {
      const member = await guild.members.fetch(userId).catch(() => null);
      if (member && member.communicationDisabledUntilTimestamp && member.communicationDisabledUntilTimestamp > Date.now()) {
        isTimeout = true;
      }
    }

    if (!isTimeout) {
      await message.reply(replyCommandError(configService, "Cet utilisateur n'est pas Timeout.", commandPrefix));
      return;
    }

    const reason = INTERNAL_REVOKE_REASON;

    try {
      await sanctionService.revokeMute({ guild, sanction, executorUser: message.author, reason });

      const embed = buildUnmuteSuccessEmbed(configService, userId);
      await message.reply({ embeds: [embed] });
    } catch (error) {
      await message.reply(replyCommandError(configService, error.message, commandPrefix));
    }
  }
};
