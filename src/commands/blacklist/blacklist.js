const { ActionKeys } = require('../../utils/actionKeys');
const { parseDuration } = require('../../utils/time');
const { buildBlacklistSuccessEmbed, buildAlreadyBlacklistedEmbed, isAlreadyBlacklistedError } = require('../../utils/sanctionSuccessEmbeds');
const { helpEntries } = require('../definitions/helpContent');
const { cloneHelpData, replyCommandError } = require('../helpers/usageMessages');
const { sendBlacklistList } = require('../../utils/blacklistListHelpers');

const help = cloneHelpData(helpEntries.blacklist);

const ensureReason = (reason) => (reason && reason.trim().length > 0 ? reason : 'Aucune raison fournie');

const parseDurationFromArgs = (args) => {
  const token = args.shift();
  if (!token) {
    return { milliseconds: null, consumed: false };
  }
  const parsed = parseDuration(token);
  if (!parsed.milliseconds) {
    args.unshift(token);
    return { milliseconds: null, consumed: false };
  }
  return { ...parsed, consumed: true };
};

const handleApply = async (context) => {
  const { message, args, registry, sanctionService, configService, permissionService } = context;
  const guild = message.guild;
  if (!guild) {
    return;
  }

  const executorMember = message.member;
  const commandPrefix = configService.getPrefix();

  const target = await registry.resolveCommandTarget(message, args, { allowReplyWithoutToken: false });
  if (target.error) {
    await message.reply(replyCommandError(configService, target.error, commandPrefix));
    return;
  }

  let durationMs = null;
  if (args.length > 0) {
    const parsed = parseDurationFromArgs(args);
    if (parsed.consumed) {
      durationMs = parsed.milliseconds;
    }
  }

  const rawReason = args.join(' ');
  const guard = await registry.runActionWithGuards({
    source: message,
    actionKey: ActionKeys.BLACKLIST,
    commandKey: help.key,
    executorMember,
    message,
    reason: rawReason,
    durationMs,
  });
  if (guard.blocked) {
    return;
  }

  const targetUser = await message.client.users.fetch(target.userId).catch(() => null);
  if (!targetUser) {
    await message.reply(replyCommandError(configService, 'Utilisateur introuvable.', commandPrefix));
    return;
  }

  const reason = ensureReason(rawReason);

  try {
    const record = await sanctionService.applyBlacklist({
      guild,
      targetUser,
      executorUser: message.author,
      executorMember,
      reason,
      durationMs
    });
    const embed = buildBlacklistSuccessEmbed(configService, record.target_id, reason);
    await message.reply({ embeds: [embed] });
  } catch (error) {
    if (isAlreadyBlacklistedError(error)) {
      await message.reply({ embeds: [buildAlreadyBlacklistedEmbed(configService)] });
      return;
    }
    await message.reply(replyCommandError(configService, error.message, commandPrefix));
  }
};

module.exports = {
  type: 'apply',
  description: 'Blacklist serveur',
  prefix: {
    aliases: ['blacklist', 'bl']
  },
  actionKey: ActionKeys.BLACKLIST,
  help,
  handlePrefix: async (context) => {
    const { message, args, registry, sanctionService, configService } = context;
    const guild = message.guild;
    if (!guild) {
      return;
    }

    if (args.length === 0) {
      const guard = await registry.runActionWithGuards({
        source: message,
        actionKey: ActionKeys.BLACKLIST,
        commandKey: help.key,
        executorMember: message.member,
        message,
        reason: 'Liste BL'
      });
      if (guard.blocked) {
        return;
      }
      await sendBlacklistList({ message, sanctionService, configService });
      return;
    }

    await handleApply(context);
  }
};
