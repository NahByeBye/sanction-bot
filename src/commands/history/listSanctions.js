const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { ActionKeys, SanctionTypes } = require('../../utils/actionKeys');
const { buildEmbed } = require('../../utils/embedFactory');
const { formatDuration, discordTimestamp } = require('../../utils/time');
const { helpEntries } = require('../definitions/helpContent');
const { cloneHelpData, replyCommandError } = require('../helpers/usageMessages');

const ITEMS_PER_PAGE = 5;

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

const describeSanction = (sanction, memberIndex) => {
  const typeDisplay = sanction.duration_ms
    ? `${sanction.type} (${formatDuration(sanction.duration_ms)})`
    : sanction.type;

  const dateStr = sanction.created_at
    ? discordTimestamp(sanction.created_at, 'f')
    : 'N/A';

  return `**Sanction ID #${memberIndex}** — ${typeDisplay}
├ Raison : ${sanction.reason || 'N/A'}
├ Date : ${dateStr}
└ Statut : ${sanction.active ? ' Active' : ' Révoquée'}`;
};

const buildListingEmbed = (configService, targetTag, sanctions, indexMap, page = 1) => {
  const totalPages = Math.ceil(sanctions.length / ITEMS_PER_PAGE) || 1;
  const start = (page - 1) * ITEMS_PER_PAGE;
  const end = start + ITEMS_PER_PAGE;
  const paginatedSanctions = sanctions.slice(start, end);

  const description = paginatedSanctions.length > 0
    ? paginatedSanctions
        .map((sanction) => describeSanction(sanction, indexMap.get(sanction.id)))
        .join('\n\n')
    : 'Aucune sanction.';

  return buildEmbed(configService, {
    title: `Sanctions de ${targetTag}`,
    description: `**Total :** ${sanctions.length}\n\n${description}\n\n**Page ${page}/${totalPages}**`
  });
};

const buildPaginationRow = (currentPage, totalPages) => {
  const row = new ActionRowBuilder();

  if (totalPages <= 1) return null;

  row.addComponents(
    new ButtonBuilder()
      .setCustomId('listprev')
      .setLabel('◀ Précédent')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(currentPage <= 1),
    new ButtonBuilder()
      .setCustomId('listnext')
      .setLabel('Suivant ▶')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(currentPage >= totalPages)
  );

  return row;
};

const help = cloneHelpData(helpEntries.listsanctions);

module.exports = {
  prefix: {
    aliases: ['listsanctions', 'sanctions', 'sanction', 'list']
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
      await message.reply(replyCommandError(configService, 'Utilisateur introuvable.', commandPrefix));
      return;
    }

    const indexMap = sanctionService.getMemberSanctionIndexMap(guild.id, userId);
    const sanctions = sanctionService.listSanctionHistory(guild.id, userId, 100, 0);
    const filtered = typeFilter
      ? sanctions.filter((s) => s.type.toLowerCase() === typeFilter.toLowerCase())
      : sanctions;

    if (filtered.length === 0) {
      await message.reply(replyCommandError(configService, 'Aucune sanction trouvée.', commandPrefix));
      return;
    }

    const embed = buildListingEmbed(
      configService,
      targetUser.tag || targetUser.username,
      filtered,
      indexMap,
      1
    );
    await message.reply({ embeds: [embed] });
  },
  actionKey: ActionKeys.LIST,
  help,

  handlePagination: async ({ interaction, registry, sanctionService, configService }) => {
    const customId = interaction.customId;
    if (customId !== 'listprev' && customId !== 'listnext') return false;

    const message = interaction.message;
    if (!message || !message.embeds.length) return false;

    const embedDesc = message.embeds[0].description;
    const pageMatch = embedDesc.match(/\*\*Page (\d+)\/(\d+)\*\*$/);
    if (!pageMatch) return false;

    let currentPage = parseInt(pageMatch[1], 10);
    const totalPages = parseInt(pageMatch[2], 10);

    if (customId === 'listprev') currentPage--;
    else if (customId === 'listnext') currentPage++;

    if (currentPage < 1 || currentPage > totalPages) return false;

    const title = message.embeds[0].title || '';
    const targetTag = title.replace('Sanctions de ', '');

    const guild = interaction.guild;
    if (!guild) return false;

    let targetUserId = null;
    try {
      const members = await guild.members.fetch();
      const found = members.find(m => (m.user.tag || m.user.username) === targetTag);
      if (found) targetUserId = found.id;
    } catch {
      return false;
    }

    if (!targetUserId) return false;

    const indexMap = sanctionService.getMemberSanctionIndexMap(guild.id, targetUserId);
    const sanctions = sanctionService.listSanctionHistory(guild.id, targetUserId, 100, 0);

    const embed = buildListingEmbed(configService, targetTag, sanctions, indexMap, currentPage);
    const row = buildPaginationRow(currentPage, totalPages);

    await interaction.update({
      embeds: [embed],
      components: row ? [row] : []
    });

    return true;
  }
};