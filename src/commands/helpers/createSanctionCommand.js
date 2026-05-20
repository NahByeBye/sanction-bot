const { parseDuration, formatDuration } = require('../../utils/time');

const { buildEmbed } = require('../../utils/embedFactory');
const {
  buildBanSuccessEmbed,
  buildMuteSuccessEmbed,
  buildKickSuccessEmbed,
  buildUnblacklistSuccessEmbed,
  buildUnmuteSuccessEmbed,
  buildAlreadyMutedEmbed,
  buildAlreadyBannedEmbed,
  isAlreadyMutedError,
  isAlreadyBannedError,
  INTERNAL_REVOKE_REASON
} = require('../../utils/sanctionSuccessEmbeds');

const { cloneHelpData, replyCommandError } = require('./usageMessages');



const ensureReason = (reason) => (reason && reason.trim().length > 0 ? reason : 'Aucune raison fournie');



const parseDurationFromArgs = (args) => {

  const token = args.shift();

  if (!token) {

    return { milliseconds: null, human: null, consumed: false };

  }

  const parsed = parseDuration(token);

  if (!parsed.milliseconds) {

    args.unshift(token);

    return { milliseconds: null, human: null, consumed: false };

  }

  return { ...parsed, consumed: true };

};



const defaultEmbedFields = (record, reason, includeDuration = true) => {

  const fields = [

    { name: 'Utilisateur', value: `<@${record.target_id}>`, inline: true }

  ];

  if (includeDuration) {

    fields.push({ name: 'Durée', value: formatDuration(record.duration_ms), inline: true });

  }

  fields.push({ name: 'Raison', value: reason });

  return fields;

};



const defaultRevocationFields = (userId, reason) => [

  { name: 'Utilisateur', value: `<@${userId}>`, inline: true },

  { name: 'Raison', value: reason }

];



const createSanctionApplyCommand = (options) => {

  const {

    description,

    actionKey,

    prefixAliases,

    embedTitle,

    includeDurationInEmbed = true,

    applySuccessStyle,

    apply,

    durationErrorMessage = 'Durée invalide.'

  } = options;



  const help = cloneHelpData(options.help);

  const durationMode = options.durationOption?.mode ?? 'none';



  const handlePrefix = async (context) => {

    const { message, args, registry, sanctionService, configService } = context;

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

    let durationMs = null;

    if (durationMode === 'required') {

      const token = args.shift();

      if (!token) {

        await message.reply(replyCommandError(configService, durationErrorMessage, commandPrefix));

        return;

      }

      const parsed = parseDuration(token);

      if (!parsed.milliseconds) {

        await message.reply(replyCommandError(configService, durationErrorMessage, commandPrefix));

        return;

      }

      durationMs = parsed.milliseconds;

    } else if (durationMode === 'optional' && args.length > 0) {

      const parsed = parseDurationFromArgs(args);

      if (parsed.consumed) {

        durationMs = parsed.milliseconds;

      }

    }



    const rawReason = args.join(' ');

    const guard = await registry.runActionWithGuards({

      source: message,

      actionKey,

      commandKey: help.key,

      executorMember,

      message,

      reason: rawReason,

      durationMs,

    });

    if (guard.blocked) {

      return;

    }



    const targetUser = await message.client.users.fetch(userId).catch(() => null);

    if (!targetUser) {

      await message.reply(replyCommandError(configService, 'Utilisateur introuvable.', commandPrefix));

      return;

    }



    const reason = ensureReason(rawReason);



    try {

      const record = await apply({

        sanctionService,

        guild,

        targetUser,

        executorUser: message.author,

        executorMember,

        reason,

        durationMs

      });

      let embed;
      if (applySuccessStyle === 'ban') {
        embed = buildBanSuccessEmbed(configService, targetUser.id, reason);
      } else if (applySuccessStyle === 'mute') {
        embed = buildMuteSuccessEmbed(configService, targetUser.id, reason, null);
      } else if (applySuccessStyle === 'kick') {
        embed = buildKickSuccessEmbed(configService, targetUser.id, reason);
      } else {
        embed = buildEmbed(configService, {
          title: embedTitle,
          fields: defaultEmbedFields({ target_id: targetUser.id, duration_ms: durationMs }, reason, includeDurationInEmbed)
        });
      }

      await message.reply({ embeds: [embed] });

    } catch (error) {
      if (isAlreadyMutedError(error)) {
        await message.reply({ embeds: [buildAlreadyMutedEmbed(configService)] });
        return;
      }
      if (isAlreadyBannedError(error)) {
        await message.reply({ embeds: [buildAlreadyBannedEmbed(configService)] });
        return;
      }
      await message.reply(replyCommandError(configService, error.message, commandPrefix));
    }

  };



  return {

    type: 'apply',

    description,

    prefix: prefixAliases && prefixAliases.length > 0 ? { aliases: prefixAliases } : null,

    handlePrefix,

    actionKey,

    help

  };

};



const createSanctionRevokeCommand = (options) => {

  const {

    description,

    actionKey,

    prefixAliases,

    embedTitle,

    sanctionTypes,

    revokeSuccessStyle,

    revoke

  } = options;



  const help = cloneHelpData(options.help);



  const handlePrefix = async (context) => {

    const { message, args, registry, sanctionService, configService } = context;

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

      actionKey,

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



    const sanction = sanctionService.findActiveSanction(guild.id, userId, sanctionTypes);

    if (!sanction) {

      await message.reply(replyCommandError(configService, 'Aucune sanction active trouvée.', commandPrefix));

      return;

    }



    const reason = INTERNAL_REVOKE_REASON;



    try {

      await revoke({

        sanctionService,

        guild,

        sanction,

        executorUser: message.author,

        reason

      });

      let embed;
      if (revokeSuccessStyle === 'unblacklist') {
        embed = buildUnblacklistSuccessEmbed(configService, userId);
      } else if (revokeSuccessStyle === 'unmute') {
        embed = buildUnmuteSuccessEmbed(configService, userId);
      } else {
        embed = buildEmbed(configService, {
          title: embedTitle,
          fields: defaultRevocationFields(userId, reason)
        });
      }

      await message.reply({ embeds: [embed] });

    } catch (error) {

      await message.reply(replyCommandError(configService, error.message, commandPrefix));

    }

  };



  return {

    type: 'revoke',

    description,

    prefix: prefixAliases && prefixAliases.length > 0 ? { aliases: prefixAliases } : null,

    handlePrefix,

    actionKey,

    help

  };

};



module.exports = {

  createSanctionApplyCommand,

  createSanctionRevokeCommand

};

