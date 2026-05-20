const {
  ActionRowBuilder,
  StringSelectMenuBuilder,
  EmbedBuilder,
  MessageFlags
} = require('discord.js');
const { sanctionsConfig } = require('../../config/sanctionsConfig');
const { buildEmbed } = require('../../utils/embedFactory');
const { buildAlreadyMutedEmbed, isAlreadyMutedError } = require('../../utils/sanctionSuccessEmbeds');

const extractMotifLabel = (entryLabel) => {
  const match = entryLabel.match(/\(([^)]+)\)/);
  return match ? match[1] : entryLabel;
};

const buildReasonFromSelection = (categoryConfig, stepConfig) =>
  `[${categoryConfig.label}] ${extractMotifLabel(stepConfig.label)}`;

const FLOW_DEFINITIONS = {
  tempmute: {
    permissionAction: 'sanction:tempmute',
    categoryTitle: 'Selectionner la categorie',
    stepTitlePrefix: 'Selectionner la duree',
    stepPlaceholder: 'Choisissez la categorie',
    stepPlaceholderSecond: 'Choisissez la duree',
    stepPrompt: 'Choisissez la duree de la sanction.',
    stepKey: 'duration',
    successTitle: 'Mute appliqué',
    mapStepOptions: (categoryConfig) =>
      categoryConfig.durations.map((entry) => ({
        label: entry.label,
        value: entry.value
      })),
    apply: async ({ sanctionService, guild, targetUser, executorUser, executorMember, categoryConfig, stepConfig, reason }) => {
      const durationMs = stepConfig.duration;
      if (!durationMs) {
        throw new Error('Durée invalide sélectionnée.');
      }
      return sanctionService.applyMute({
        guild,
        targetUser,
        executorUser,
        executorMember,
        reason,
        durationMs,
        muteType: 'tempmute_role'
      });
    },
    buildSuccessFields: ({ categoryConfig, stepConfig }) => [
      { name: 'Catégorie', value: categoryConfig.label, inline: false },
      { name: 'Durée', value: stepConfig.label, inline: true }
    ]
  },
  warn: {
    permissionAction: 'sanction:warn',
    skipDuration: true,
    categoryTitle: 'Selectionner la categorie',
    stepTitlePrefix: 'Selectionner le motif',
    stepPlaceholder: 'Choisissez la categorie',
    stepPlaceholderSecond: 'Choisissez le motif',
    stepPrompt: 'Choisissez le motif de l\'avertissement.',
    stepKey: 'motif',
    successTitle: 'Warn appliqué',
    mapStepOptions: (categoryConfig) =>
      categoryConfig.durations.map((entry) => ({
        label: extractMotifLabel(entry.label),
        value: entry.value
      })),
    apply: async ({ sanctionService, guild, targetUser, executorUser, executorMember, reason }) =>
      sanctionService.applyWarn({
        guild,
        targetUser,
        executorUser,
        executorMember,
        reason
      }),
    buildSuccessFields: ({ categoryConfig, stepConfig }) => [
      { name: 'Categorie', value: categoryConfig.label, inline: false },
      { name: 'Motif', value: extractMotifLabel(stepConfig.label), inline: true }
    ]
  }
};

const buildCategoryMenu = (flowPrefix, targetUserId, executorUserId, placeholder) =>
  new StringSelectMenuBuilder()
    .setCustomId(`${flowPrefix}_category_${targetUserId}_${executorUserId}`)
    .setPlaceholder(placeholder)
    .addOptions(
      Object.entries(sanctionsConfig).map(([key, config]) => ({
        label: config.label,
        value: key
      }))
    );

const buildStepMenu = (flowPrefix, definition, targetUserId, executorUserId, categoryKey, categoryConfig) =>
  new StringSelectMenuBuilder()
    .setCustomId(`${flowPrefix}_${definition.stepKey}_${targetUserId}_${executorUserId}_${categoryKey}`)
    .setPlaceholder(definition.stepPlaceholderSecond)
    .addOptions(definition.mapStepOptions(categoryConfig));

const buildCategoryEmbed = (configService, definition, targetUser) =>
  new EmbedBuilder()
    .setColor(configService.getColor())
    .setTitle(definition.categoryTitle)
    .setDescription(
      `**Utilisateur:** <@${targetUser.id}> (\`${targetUser.id}\`)\n\nChoisissez la categorie.`
    )
    .setFooter({ text: configService.getFooter() })
    .setTimestamp();

const buildCategoryComponents = (flowPrefix, definition, targetUser, executorUserId) => [
  new ActionRowBuilder().addComponents(
    buildCategoryMenu(flowPrefix, targetUser.id, executorUserId, definition.stepPlaceholder)
  )
];

const applyCategorizedSanction = async ({
  interaction,
  flowPrefix,
  definition,
  configService,
  sanctionService,
  targetUserId,
  selectedCategory,
  selectedStep
}) => {
  const categoryConfig = sanctionsConfig[selectedCategory];
  const stepConfig = categoryConfig?.durations.find((entry) => entry.value === selectedStep);

  if (!categoryConfig || !stepConfig) {
    await interaction.editReply({ content: 'Selection invalide.', embeds: [], components: [] });
    return;
  }

  const targetUser = await interaction.client.users.fetch(targetUserId).catch(() => null);
  if (!targetUser) {
    await interaction.editReply({ content: 'Utilisateur introuvable.', embeds: [], components: [] });
    return;
  }

  const guild = interaction.guild;
  const member = await guild.members.fetch(targetUserId).catch(() => null);
  if (!member) {
    await interaction.editReply({ content: 'Utilisateur introuvable dans le serveur.', embeds: [], components: [] });
    return;
  }

  const executorMember = interaction.member;
  const reason = buildReasonFromSelection(categoryConfig, stepConfig);

  const record = await definition.apply({
    sanctionService,
    guild,
    targetUser,
    executorUser: interaction.user,
    executorMember,
    categoryConfig,
    stepConfig,
    reason
  });

  const successEmbed = buildEmbed(configService, {
    title: definition.successTitle,
    fields: [
      { name: 'Utilisateur', value: `<@${targetUser.id}>`, inline: true },
      ...definition.buildSuccessFields({ categoryConfig, stepConfig, reason })
    ]
  });

  await interaction.editReply({ embeds: [successEmbed], components: [] });
};

const guardTempmuteNotAlreadyMuted = async ({ flowPrefix, guild, targetUserId, sanctionService, reply }) => {
  if (flowPrefix !== 'tempmute') {
    return true;
  }
  try {
    await sanctionService.assertNotMuted(guild, targetUserId);
    return true;
  } catch (error) {
    if (isAlreadyMutedError(error)) {
      await reply();
      return false;
    }
    throw error;
  }
};

const startCategorizedSanctionFlow = async ({ interaction, configService, targetUser, flowPrefix, sanctionService }) => {
  const definition = FLOW_DEFINITIONS[flowPrefix];
  if (!definition) {
    throw new Error(`Flux inconnu: ${flowPrefix}`);
  }

  const allowed = await guardTempmuteNotAlreadyMuted({
    flowPrefix,
    guild: interaction.guild,
    targetUserId: targetUser.id,
    sanctionService,
    reply: () => interaction.reply({
      embeds: [buildAlreadyMutedEmbed(configService)],
      flags: MessageFlags.Ephemeral
    })
  });
  if (!allowed) {
    return;
  }

  await interaction.reply({
    embeds: [buildCategoryEmbed(configService, definition, targetUser)],
    components: buildCategoryComponents(flowPrefix, definition, targetUser, interaction.user.id),
    flags: MessageFlags.Ephemeral
  });
};

const startCategorizedSanctionFlowFromMessage = async ({ message, configService, targetUser, flowPrefix, sanctionService }) => {
  const definition = FLOW_DEFINITIONS[flowPrefix];
  if (!definition) {
    throw new Error(`Flux inconnu: ${flowPrefix}`);
  }

  const allowed = await guardTempmuteNotAlreadyMuted({
    flowPrefix,
    guild: message.guild,
    targetUserId: targetUser.id,
    sanctionService,
    reply: () => message.reply({ embeds: [buildAlreadyMutedEmbed(configService)] })
  });
  if (!allowed) {
    return;
  }

  await message.reply({
    embeds: [buildCategoryEmbed(configService, definition, targetUser)],
    components: buildCategoryComponents(flowPrefix, definition, targetUser, message.author.id)
  });
};

const handleCategorizedSanctionInteraction = async (interaction, { flowPrefix, configService, sanctionService }) => {
  const definition = FLOW_DEFINITIONS[flowPrefix];
  if (!definition) {
    return false;
  }

  const customId = interaction.customId;
  if (!customId.startsWith(`${flowPrefix}_`)) {
    return false;
  }

  const stepPrefix = `${flowPrefix}_${definition.stepKey}_`;

  if (customId.startsWith(`${flowPrefix}_category_`)) {
    const parts = customId.split('_');
    const targetUserId = parts[2];
    const executorUserId = parts[3];
    const selectedCategory = interaction.values[0];
    const categoryConfig = sanctionsConfig[selectedCategory];

    if (!categoryConfig) {
      await interaction.reply({ content: 'Categorie invalide.', flags: MessageFlags.Ephemeral });
      return true;
    }

    const embed = new EmbedBuilder()
      .setColor(configService.getColor())
      .setTitle(`${definition.stepTitlePrefix} - ${categoryConfig.label}`)
      .setDescription(
        `**Utilisateur:** <@${targetUserId}>\n**Categorie:** ${categoryConfig.label}\n\n${definition.stepPrompt}`
      )
      .setFooter({ text: configService.getFooter() })
      .setTimestamp();

    await interaction.update({
      embeds: [embed],
      components: [
        new ActionRowBuilder().addComponents(
          buildStepMenu(flowPrefix, definition, targetUserId, executorUserId, selectedCategory, categoryConfig)
        )
      ]
    });
    return true;
  }

  if (customId.startsWith(stepPrefix)) {
    const parts = customId.split('_');
    const targetUserId = parts[2];
    const selectedCategory = parts.slice(4).join('_');
    const selectedStep = interaction.values[0];
    const categoryConfig = sanctionsConfig[selectedCategory];
    const stepConfig = categoryConfig?.durations.find((entry) => entry.value === selectedStep);

    if (!stepConfig) {
      await interaction.reply({
        content: definition.skipDuration ? 'Motif invalide.' : 'Duree invalide.',
        flags: MessageFlags.Ephemeral
      });
      return true;
    }

    await interaction.deferUpdate();

    try {
      await applyCategorizedSanction({
        interaction,
        flowPrefix,
        definition,
        configService,
        sanctionService,
        targetUserId,
        selectedCategory,
        selectedStep
      });
    } catch (error) {
      if (isAlreadyMutedError(error)) {
        await interaction.editReply({
          embeds: [buildAlreadyMutedEmbed(configService)],
          components: []
        }).catch(() => {});
        return true;
      }
      console.error(`${flowPrefix} error:`, error);
      await interaction.editReply({ content: `Erreur: ${error.message}`, embeds: [], components: [] }).catch(() => {});
    }
    return true;
  }

  return false;
};

module.exports = {
  FLOW_DEFINITIONS,
  startCategorizedSanctionFlow,
  startCategorizedSanctionFlowFromMessage,
  handleCategorizedSanctionInteraction
};
