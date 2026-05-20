const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { buildEmbed } = require('./embedFactory');

const ITEMS_PER_PAGE = 10;
const BUTTON_PREFIX = 'bl_list';

const formatBlacklistUsername = (sanction) => {
  const tag = sanction.target_tag || 'unknown';
  const username = tag.includes('#') ? tag.split('#')[0] : tag;
  return username;
};

const formatBlacklistEntry = (sanction) => {
  const username = formatBlacklistUsername(sanction);
  return `• \`${username} (${sanction.target_id})\``;
};

const buildBlacklistListEmbed = (configService, sanctions, page = 1) => {
  const total = sanctions.length;
  const totalPages = Math.max(1, Math.ceil(total / ITEMS_PER_PAGE));
  const safePage = Math.min(Math.max(page, 1), totalPages);
  const start = (safePage - 1) * ITEMS_PER_PAGE;
  const pageItems = sanctions.slice(start, start + ITEMS_PER_PAGE);

  const lines = pageItems.length > 0
    ? pageItems.map(formatBlacklistEntry).join('\n')
    : 'Aucun utilisateur blacklisté.';

  const description = `${lines}\n\nPage ${safePage}/${totalPages}`;

  return buildEmbed(configService, {
    title: `Liste BL (${total})`,
    description,
    timestamp: false,
    suppressFooter: true
  });
};

const buildBlacklistPaginationRow = (guildId, page, totalPages, executorId) => {
  if (totalPages <= 1) {
    return null;
  }

  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`${BUTTON_PREFIX}:prev:${guildId}:${page}:${executorId}`)
      .setLabel('<<')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(page <= 1),
    new ButtonBuilder()
      .setCustomId(`${BUTTON_PREFIX}:next:${guildId}:${page}:${executorId}`)
      .setLabel('>>')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(page >= totalPages)
  );
};

const parseBlacklistListButtonId = (customId) => {
  if (!customId?.startsWith(`${BUTTON_PREFIX}:`)) {
    return null;
  }
  const parts = customId.split(':');
  if (parts.length !== 5) {
    return null;
  }
  const direction = parts[1];
  if (direction !== 'prev' && direction !== 'next') {
    return null;
  }
  const guildId = parts[2];
  const page = parseInt(parts[3], 10);
  const executorId = parts[4];
  if (!guildId || !executorId || Number.isNaN(page)) {
    return null;
  }
  return { direction, guildId, page, executorId };
};

const handleBlacklistListPagination = async ({
  interaction,
  sanctionService,
  configService
}) => {
  const parsed = parseBlacklistListButtonId(interaction.customId);
  if (!parsed) {
    return false;
  }

  if (interaction.user.id !== parsed.executorId) {
    await interaction.reply({
      content: 'Seul l’utilisateur qui a exécuté cette commande peut utiliser la pagination.',
      ephemeral: true
    }).catch(() => {});
    return true;
  }

  const guild = interaction.guild;
  if (!guild || guild.id !== parsed.guildId) {
    return false;
  }

  const sanctions = sanctionService.listActiveBlacklists(guild.id);
  const totalPages = Math.max(1, Math.ceil(sanctions.length / ITEMS_PER_PAGE));
  let page = parsed.page;
  if (parsed.direction === 'prev') {
    page -= 1;
  } else {
    page += 1;
  }
  page = Math.min(Math.max(page, 1), totalPages);

  const embed = buildBlacklistListEmbed(configService, sanctions, page);
  const row = buildBlacklistPaginationRow(guild.id, page, totalPages, parsed.executorId);

  await interaction.update({
    embeds: [embed],
    components: row ? [row] : []
  });
  return true;
};

const sendBlacklistList = async ({ message, sanctionService, configService }) => {
  const guild = message.guild;
  const sanctions = sanctionService.listActiveBlacklists(guild.id);
  const totalPages = Math.max(1, Math.ceil(sanctions.length / ITEMS_PER_PAGE));
  const embed = buildBlacklistListEmbed(configService, sanctions, 1);
  const row = buildBlacklistPaginationRow(guild.id, 1, totalPages, message.author.id);
  await message.reply({
    embeds: [embed],
    components: row ? [row] : []
  });
};

module.exports = {
  ITEMS_PER_PAGE,
  BUTTON_PREFIX,
  buildBlacklistListEmbed,
  buildBlacklistPaginationRow,
  handleBlacklistListPagination,
  sendBlacklistList
};
