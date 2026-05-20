module.exports = [
  {
    handleSlash: async ({ interaction, configService }) => {
      const primaryOwnerId = configService.get('ownerId');

      if (interaction.user.id !== primaryOwnerId) {
        await interaction.reply({
          content: 'Seul le propriétaire principal du bot peut utiliser cette commande.',
          ephemeral: true
        });
        return;
      }

      const clientId = configService.get('clientId');
      const inviteLink = `https://discord.com/api/oauth2/authorize?client_id=${clientId}&permissions=8&scope=bot%20applications.commands`;

      const embed = {
        color: parseInt(configService.get('color').replace('#', ''), 16),
        description: `[Cliquez ici pour inviter le bot](${inviteLink})`,
        footer: {
          text: configService.get('footer')
        }
      };

      await interaction.reply({
        embeds: [embed],
        ephemeral: true
      });
    }
  }
];
