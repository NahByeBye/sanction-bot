const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { buildEmbed } = require('./embedFactory');

const ITEMS_PER_PAGE = 5;
const BUTTON_PREFIX = 'user_sanction_list';

const formatSanctionEntry = (sanction, index, page) => {
  const timestamp = Math.floor(sanction.created_at / 1000);
  const globalIndex = (page - 1) * ITEMS_PER_PAGE + index + 1;
  return `**#${globalIndex}** <@${sanction.target_id}> (\`${sanction.target_id}\`)\nRaison : ${sanction.reason || '-'}\n<t:${timestamp}:F>`;
};

const buildUserSanctionListEmbed = (configService, sanctions, targetUser, sanctionType, page = 1) => {
  const total = sanctions.length;
  const totalPages = Math.max(1, Math.ceil(total / ITEMS_PER_PAGE));
  const safePage = Math.min(Math.max(page, 1), totalPages);
  const start = (safePage - 1) * ITEMS_PER_PAGE;
  const pageItems = sanctions.slice(start, start + ITEMS_PER_PAGE);

  const lines = pageItems.length > 0
    ? pageItems.map((s, i) => formatSanctionEntry(s, i, safePage)).join('\n\n')
    : 'Aucune sanction trouvée.';

  const description = `${lines}\n\nPage ${safePage}/${totalPages}`;

  return buildEmbed(configService, {
    title: `${sanctionType} de ${targetUser.username} (${total})`,
    description,
    timestamp: false,
    suppressFooter: true
  });
};

const buildUserSanctionPaginationRow = (executorId, page, totalPages) => {
  if (totalPages <= 1) {
    return null;
  }

  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`${BUTTON_PREFIX}:prev:${page}:${executorId}`)
      .setLabel('<<')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(page <= 1),
    new ButtonBuilder()
      .setCustomId(`${BUTTON_PREFIX}:next:${page}:${executorId}`)
      .setLabel('>>')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(page >= totalPages)
  );
};

const parseUserSanctionListButtonId = (customId) => {
  if (!customId?.startsWith(`${BUTTON_PREFIX}:`)) {
    return null;
  }
  const parts = customId.split(':');
  if (parts.length !== 4) {
    return null;
  }
  const direction = parts[1];
  if (direction !== 'prev' && direction !== 'next') {
    return null;
  }
  const page = parseInt(parts[2], 10);
  const executorId = parts[3];
  if (!executorId || Number.isNaN(page)) {
    return null;
  }
  return { direction, page, executorId };
};

const sendUserSanctionList = async ({ message, sanctions, targetUser, sanctionType, configService }) => {
  const totalPages = Math.max(1, Math.ceil(sanctions.length / ITEMS_PER_PAGE));
  const embed = buildUserSanctionListEmbed(configService, sanctions, targetUser, sanctionType, 1);
  const row = buildUserSanctionPaginationRow(message.author.id, 1, totalPages);
  await message.reply({
    embeds: [embed],
    components: row ? [row] : []
  });
};

module.exports = {
  ITEMS_PER_PAGE,
  BUTTON_PREFIX,
  buildUserSanctionListEmbed,
  buildUserSanctionPaginationRow,
  parseUserSanctionListButtonId,
  sendUserSanctionList
};
