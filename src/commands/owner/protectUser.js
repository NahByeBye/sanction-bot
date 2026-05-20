const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { buildEmbed } = require('../../utils/embedFactory');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('protect-user')
    .setDescription('Protect un user')
    .addStringOption(option =>
      option.setName('user')
        .setDescription('User à protéger')
        .setRequired(true)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  handleSlash: async ({ interaction, db, configService }) => {
    const user = interaction.options.getUser('user');
    const userId = user.id;
    const executorId = interaction.user.id;

    if (!db.isOwner(executorId)) {
      await interaction.reply({ content: 'Seuls les Owner bot peuvent utiliser cette commande.', ephemeral: true });
      return;
    }

    const existing = db.isUserProtected(userId);

    if (existing) {
      db.removeProtectedUser(userId);
      const embed = buildEmbed(configService, {
        description: `✓ <@${userId}> n'est plus protect.`
      });
      await interaction.reply({ embeds: [embed] });
    } else {
      db.addProtectedUser(userId, executorId);
      const embed = buildEmbed(configService, {
        description: `✓ <@${userId}> est maintenant protect.`
      });
      await interaction.reply({ embeds: [embed] });
    }
  }
};
