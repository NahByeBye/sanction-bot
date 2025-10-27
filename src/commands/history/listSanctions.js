const { ActionKeys, SanctionTypes } = require('../../utils/actionKeys');
const { buildEmbed } = require('../../utils/embedFactory');
const { formatDuration } = require('../../utils/time');
const { helpEntries } = require('../definitions/helpContent');
const { cloneHelpData, buildUsageResponse } = require('../helpers/usageMessages');

const LIST_CHOICES = [
  { name: 'Tous', value: 'any' },
  { name: 'Ban', value: SanctionTypes.BAN },
  { name: 'TempBan', value: SanctionTypes.TEMPBAN },
  { name: 'Kick', value: SanctionTypes.KICK },
  { name: 'Warn', value: SanctionTypes.WARN },
  { name: 'Mute', value: SanctionTypes.MUTE },
  { name: 'TempMute', value: SanctionTypes.TEMPMUTE },
  { name: 'Blacklist', value: SanctionTypes.BLACKLIST },
  { name: 'TempBlacklist', value: SanctionTypes.TEMPBLACKLIST }
];

const describeSanction = (sanction) => {
  const isInstant = sanction.type === SanctionTypes.KICK;
  const status = isInstant ? '🚪 Exécutée' : sanction.active ? '✅ Active' : '❎ Levée';
  const duration = sanction.duration_ms ? formatDuration(sanction.duration_ms) : isInstant ? 'instantanée' : 'permanent';
  const date = new Date(sanction.created_at).toLocaleString();
  return `• #${sanction.id} • ${sanction.type} • ${status}\n  Durée: ${duration}\n  Date: ${date}\n  Raison: ${sanction.reason}`;
};

const buildListingEmbed = (configService, targetTag, sanctions) =>
  buildEmbed(configService, {
    title: `Sanctions de ${targetTag}`,
    description: sanctions.map(describeSanction).join('\n\n')
  });

const help = cloneHelpData(helpEntries.listsanctions);

module.exports = {
  standaloneSlash: true,
  slashName: 'listsanctions',
  registerSlash: (sub) =>
    sub
      .setName('listsanctions')
      .setDescription('Lister les sanctions d\'un utilisateur')
      .addUserOption((option) => option.setName('membre').setDescription('Utilisateur').setRequired(true))
      .addStringOption((option) =>
        option
          .setName('type')
          .setDescription('Filtrer par type de sanction')
          .setRequired(false)
          .addChoices(...LIST_CHOICES)
      ),
  handleSlash: async ({ interaction, registry, sanctionService, configService }) => {
    const guild = interaction.guild;
    if (!guild) {
      await interaction.reply({
        content: buildUsageResponse('Cette commande doit être utilisée dans un serveur.', help, 'slash'),
        ephemeral: true
      });
      return;
    }

    const executorMember = interaction.member;
    const targetUser = interaction.options.getUser('membre');
    const typeFilter = interaction.options.getString('type');

    const guard = await registry.runActionWithGuards({
      source: interaction,
      actionKey: ActionKeys.LIST,
      executorMember,
      interaction,
      reason: 'Listing'
    });
    if (guard.blocked) {
      return;
    }

    const sanctions = sanctionService.listSanctions(guild.id, targetUser.id, 25, 0);
    const filtered = typeFilter && typeFilter !== 'any'
      ? sanctions.filter((s) => s.type === typeFilter)
      : sanctions;

    if (filtered.length === 0) {
      await interaction.reply({ content: 'Aucune sanction enregistrée pour cet utilisateur.', ephemeral: true });
      return;
    }

    const embed = buildListingEmbed(
      configService,
      targetUser.tag || targetUser.username,
      filtered.slice(0, 10)
    );
    await interaction.reply({ embeds: [embed], ephemeral: true });
  },
  prefix: {
    aliases: ['listsanctions', 'sanctions', 'list']
  },
  handlePrefix: async ({ message, args, registry, sanctionService, configService }) => {
    const guild = message.guild;
    if (!guild) {
      return;
    }

    const executorMember = message.member;
    const userMention = args.shift();
    if (!userMention) {
      await message.reply(buildUsageResponse('Usage incorrect.', help, 'prefix'));
      return;
    }

    const userId = registry.extractUserId(userMention);
    if (!userId) {
      await message.reply(buildUsageResponse("Impossible de déterminer l'utilisateur.", help, 'prefix'));
      return;
    }

    const guard = await registry.runActionWithGuards({
      source: message,
      actionKey: ActionKeys.LIST,
      executorMember,
      message,
      reason: 'Listing'
    });
    if (guard.blocked) {
      return;
    }

    const typeFilter = args.shift();
    const targetUser = await message.client.users.fetch(userId).catch(() => null);
    if (!targetUser) {
      await message.reply(buildUsageResponse('Utilisateur introuvable.', help, 'prefix'));
      return;
    }

    const sanctions = sanctionService.listSanctions(guild.id, userId, 25, 0);
    const filtered = typeFilter
      ? sanctions.filter((s) => s.type.toLowerCase() === typeFilter.toLowerCase())
      : sanctions;

    if (filtered.length === 0) {
      await message.reply(buildUsageResponse('Aucune sanction trouvée.', help, 'prefix'));
      return;
    }

    const embed = buildListingEmbed(
      configService,
      targetUser.tag || targetUser.username,
      filtered.slice(0, 10)
    );
    await message.reply({ embeds: [embed] });
  },
  actionKey: ActionKeys.LIST,
  help
};
