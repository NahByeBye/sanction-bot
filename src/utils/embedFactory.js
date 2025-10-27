const { EmbedBuilder } = require('discord.js');

const buildEmbed = (configService, { title, description, fields = [], thumbnail, timestamp = true, color, footerText, footerIcon }) => {
  const embed = new EmbedBuilder();
  embed.setColor(color || configService.getColor());
  if (title) {
    embed.setTitle(title);
  }
  if (description) {
    embed.setDescription(description);
  }
  if (Array.isArray(fields) && fields.length > 0) {
    embed.addFields(fields);
  }
  if (thumbnail) {
    embed.setThumbnail(thumbnail);
  }
  if (timestamp) {
    embed.setTimestamp(new Date());
  }
  const footer = footerText || configService.getFooter();
  if (footer) {
    embed.setFooter({ text: footer, iconURL: footerIcon || null });
  }
  return embed;
};

module.exports = { buildEmbed };
