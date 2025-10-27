const { parseDuration, formatDuration } = require('../../utils/time');
const { buildEmbed } = require('../../utils/embedFactory');
const { cloneHelpData, buildUsageHint, buildUsageResponse } = require('./usageMessages');

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
    { name: 'Utilisateur', value: `<@${record.target_id}>`, inline: true },
    { name: 'Sanction ID', value: `#${record.id}`, inline: true }
  ];
  if (includeDuration) {
    fields.push({ name: 'Durée', value: formatDuration(record.duration_ms), inline: true });
  }
  fields.push({ name: 'Raison', value: reason });
  return fields;
};

const defaultRevocationFields = (userId, sanction, reason) => [
  { name: 'Utilisateur', value: `<@${userId}>`, inline: true },
  { name: 'Sanction levée', value: `#${sanction.id}`, inline: true },
  { name: 'Raison', value: reason }
];

const createSanctionApplyCommand = (options) => {
  const {
    slashParent: providedParent,
    slashName,
    description,
    targetOptionDescription,
    reasonOptionDescription,
    durationOption,
    actionKey,
    prefixAliases,
    embedTitle,
    includeDurationInEmbed = true,
    apply,
    durationErrorMessage = 'Veuillez fournir une durée valide (ex: 7d, 12h).'
  } = options;

  const help = cloneHelpData(options.help);
  const standaloneSlash = Boolean(options.standaloneSlash);
  const slashParent = standaloneSlash ? null : providedParent;

  const durationMode = durationOption?.mode ?? 'none';

  const registerSlash = (sub) => {
    sub
      .setName(slashName)
      .setDescription(description)
      .addUserOption((option) =>
        option.setName('membre').setDescription(targetOptionDescription).setRequired(true)
      )
      .addStringOption((option) =>
        option.setName('raison').setDescription(reasonOptionDescription).setRequired(true)
      );
    if (durationMode !== 'none') {
      sub.addStringOption((option) =>
        option
          .setName('duree')
          .setDescription(durationOption.description)
          .setRequired(durationMode === 'required')
      );
    }
    return sub;
  };

  const handleSlash = async (context) => {
    const { interaction, registry, sanctionService, configService } = context;
    const guild = interaction.guild;
    if (!guild) {
      await interaction.reply({ content: 'Cette commande doit être utilisée dans un serveur.', ephemeral: true });
      return;
    }

    const executorMember = interaction.member;
    const targetUser = interaction.options.getUser('membre');
    let reason = interaction.options.getString('raison');
    const durationInput = durationMode === 'none' ? null : interaction.options.getString('duree');
    const { milliseconds: durationMs } = durationMode === 'none' ? { milliseconds: null } : parseDuration(durationInput);

    if (durationMode === 'required' && (!durationMs || durationMs <= 0)) {
      await interaction.reply({ content: buildUsageResponse(durationErrorMessage, help, 'slash'), ephemeral: true });
      return;
    }

    reason = ensureReason(reason);

    const guard = await registry.runActionWithGuards({
      source: interaction,
      actionKey,
      executorMember,
      interaction,
      reason,
      durationMs,
      usageHint: buildUsageHint(help, 'slash')
    });
    if (guard.blocked) {
      return;
    }

    try {
      const record = await apply({
        sanctionService,
        guild,
        targetUser,
        executorUser: interaction.user,
        reason,
        durationMs
      });
      const embed = buildEmbed(configService, {
        title: embedTitle,
        fields: defaultEmbedFields(record, reason, includeDurationInEmbed)
      });
      await interaction.reply({ embeds: [embed] });
    } catch (error) {
      await interaction.reply({ content: `Erreur: ${error.message}`, ephemeral: true }).catch(() => {});
    }
  };

  const handlePrefix = async (context) => {
    const { message, args, registry, sanctionService, configService } = context;
    const guild = message.guild;
    if (!guild) {
      return;
    }

    const executorMember = message.member;
    const userMention = args.shift();
    if (!userMention) {
      await message.reply(buildUsageResponse('Précisez un utilisateur.', help, 'prefix'));
      return;
    }

    const userId = registry.extractUserId(userMention);
    if (!userId) {
      await message.reply(buildUsageResponse("Impossible de déterminer l'utilisateur.", help, 'prefix'));
      return;
    }

    let durationMs = null;
    if (durationMode === 'required') {
      const token = args.shift();
      if (!token) {
        await message.reply(buildUsageResponse(durationErrorMessage, help, 'prefix'));
        return;
      }
      const parsed = parseDuration(token);
      if (!parsed.milliseconds) {
        await message.reply(buildUsageResponse(durationErrorMessage, help, 'prefix'));
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
      executorMember,
      message,
      reason: rawReason,
      durationMs,
      usageHint: buildUsageHint(help, 'prefix')
    });
    if (guard.blocked) {
      return;
    }

    const targetUser = await message.client.users.fetch(userId).catch(() => null);
    if (!targetUser) {
      await message.reply(buildUsageResponse("Utilisateur introuvable.", help, 'prefix'));
      return;
    }

    const reason = ensureReason(rawReason);

    try {
      const record = await apply({
        sanctionService,
        guild,
        targetUser,
        executorUser: message.author,
        reason,
        durationMs
      });
      const embed = buildEmbed(configService, {
        title: embedTitle,
        fields: defaultEmbedFields(record, reason, includeDurationInEmbed)
      });
      await message.reply({ embeds: [embed] });
    } catch (error) {
      await message.reply(`Erreur: ${error.message}`);
    }
  };

  return {
    type: 'apply',
    standaloneSlash,
    slashParent,
    slashName,
    slashDescription: description,
    registerSlash,
    handleSlash,
    prefix: prefixAliases && prefixAliases.length > 0 ? { aliases: prefixAliases } : null,
    handlePrefix,
    actionKey,
    help
  };
};

const createSanctionRevokeCommand = (options) => {
  const {
    slashParent: providedParent,
    slashName,
    description,
    targetOptionDescription,
    reasonOptionDescription,
    actionKey,
    prefixAliases,
    embedTitle,
    sanctionTypes,
    revoke
  } = options;

  const help = cloneHelpData(options.help);
  const standaloneSlash = Boolean(options.standaloneSlash);
  const slashParent = standaloneSlash ? null : providedParent;

  const registerSlash = (sub) =>
    sub
      .setName(slashName)
      .setDescription(description)
      .addUserOption((option) =>
        option.setName('membre').setDescription(targetOptionDescription).setRequired(true)
      )
      .addStringOption((option) =>
        option.setName('raison').setDescription(reasonOptionDescription).setRequired(true)
      );

  const handleSlash = async (context) => {
    const { interaction, registry, sanctionService, configService } = context;
    const guild = interaction.guild;
    if (!guild) {
      await interaction.reply({ content: 'Cette commande doit être utilisée dans un serveur.', ephemeral: true });
      return;
    }

    const executorMember = interaction.member;
    const targetUser = interaction.options.getUser('membre');
    const reason = ensureReason(interaction.options.getString('raison'));

    const guard = await registry.runActionWithGuards({
      source: interaction,
      actionKey,
      executorMember,
      interaction,
      reason,
      usageHint: buildUsageHint(help, 'slash')
    });
    if (guard.blocked) {
      return;
    }

    const sanction = sanctionService.findActiveSanction(guild.id, targetUser.id, sanctionTypes);
    if (!sanction) {
      await interaction.reply({ content: buildUsageResponse('Aucune sanction active trouvée pour cet utilisateur.', help, 'slash'), ephemeral: true });
      return;
    }

    try {
      await revoke({
        sanctionService,
        guild,
        sanction,
        executorUser: interaction.user,
        reason
      });
      const embed = buildEmbed(configService, {
        title: embedTitle,
        fields: defaultRevocationFields(targetUser.id, sanction, reason)
      });
      await interaction.reply({ embeds: [embed] });
    } catch (error) {
      await interaction.reply({ content: `Erreur: ${error.message}`, ephemeral: true }).catch(() => {});
    }
  };

  const handlePrefix = async (context) => {
    const { message, args, registry, sanctionService, configService } = context;
    const guild = message.guild;
    if (!guild) {
      return;
    }

    const executorMember = message.member;
    const userMention = args.shift();
    if (!userMention) {
      await message.reply(buildUsageResponse('Précisez un utilisateur.', help, 'prefix'));
      return;
    }

    const userId = registry.extractUserId(userMention);
    if (!userId) {
      await message.reply(buildUsageResponse("Impossible de déterminer l'utilisateur.", help, 'prefix'));
      return;
    }

    const rawReason = args.join(' ');
    const guard = await registry.runActionWithGuards({
      source: message,
      actionKey,
      executorMember,
      message,
      reason: rawReason,
      usageHint: buildUsageHint(help, 'prefix')
    });
    if (guard.blocked) {
      return;
    }

    const targetUser = await message.client.users.fetch(userId).catch(() => null);
    if (!targetUser) {
      await message.reply(buildUsageResponse("Utilisateur introuvable.", help, 'prefix'));
      return;
    }

    const sanction = sanctionService.findActiveSanction(guild.id, userId, sanctionTypes);
    if (!sanction) {
      await message.reply(buildUsageResponse('Aucune sanction active trouvée.', help, 'prefix'));
      return;
    }

    const reason = ensureReason(rawReason);

    try {
      await revoke({
        sanctionService,
        guild,
        sanction,
        executorUser: message.author,
        reason
      });
      const embed = buildEmbed(configService, {
        title: embedTitle,
        fields: defaultRevocationFields(userId, sanction, reason)
      });
      await message.reply({ embeds: [embed] });
    } catch (error) {
      await message.reply(`Erreur: ${error.message}`);
    }
  };

  return {
    type: 'revoke',
    standaloneSlash,
    slashParent,
    slashName,
    slashDescription: description,
    registerSlash,
    handleSlash,
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
