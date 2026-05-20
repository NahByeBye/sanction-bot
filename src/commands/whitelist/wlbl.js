const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { buildEmbed } = require('../../utils/embedFactory');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('bl-acces')
    .setDescription('Gérer la whitelist du serveur')
    .addStringOption(opt =>
      opt.setName('option')
        .setDescription('Action à effectuer')
        .setRequired(true)
        .addChoices(
          { name: 'add', value: 'add' },
          { name: 'del', value: 'del' },
          { name: 'list', value: 'list' }
        )
    )
    .addUserOption(option =>
      option
        .setName('user')
        .setDescription('L\'utilisateur')
        .setRequired(false)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  handleSlash: async ({ interaction, db, configService }) => {
    const option = interaction.options.getString('option');
    const guild = interaction.guild;

    if (!guild) {
      await interaction.reply({ content: 'Cette commande doit être utilisée dans un serveur.', ephemeral: true });
      return;
    }

    const guildId = guild.id;

    if (option === 'add') {
      const user = interaction.options.getUser('user');
      if (!user) {
        await interaction.reply({ content: 'Utilisateur introuvable.', ephemeral: true });
        return;
      }

      const userId = user.id;
      const existing = db.db.prepare('SELECT * FROM whitelist WHERE guild_id = ? AND user_id = ?').get(guildId, userId);

      if (existing) {
        const embed = buildEmbed(configService, {
          description: `✗ ${user} est déjà dans la whitelist.`
        });
        await interaction.reply({ embeds: [embed], ephemeral: true });
        return;
      }

      db.db.prepare('INSERT INTO whitelist (guild_id, user_id, added_by, added_at) VALUES (?, ?, ?, ?)')
        .run(guildId, userId, interaction.user.id, Date.now());

      const embed = buildEmbed(configService, {
        description: `✓ ${user} a été ajouté à la whitelist.`
      });
      await interaction.reply({ embeds: [embed] });

    } else if (option === 'del') {
      const user = interaction.options.getUser('user');
      if (!user) {
        await interaction.reply({ content: 'Utilisateur introuvable.', ephemeral: true });
        return;
      }

      const userId = user.id;
      const existing = db.db.prepare('SELECT * FROM whitelist WHERE guild_id = ? AND user_id = ?').get(guildId, userId);

      if (!existing) {
        const embed = buildEmbed(configService, {
          description: `✗ ${user} n'est pas dans la whitelist.`
        });
        await interaction.reply({ embeds: [embed], ephemeral: true });
        return;
      }

      db.db.prepare('DELETE FROM whitelist WHERE guild_id = ? AND user_id = ?').run(guildId, userId);

      const embed = buildEmbed(configService, {
        description: `✓ ${user} a été retiré de la whitelist.`
      });
      await interaction.reply({ embeds: [embed] });

    } else if (option === 'list') {
      const whitelisted = db.db.prepare('SELECT * FROM whitelist WHERE guild_id = ?').all(guildId);

      if (whitelisted.length === 0) {
        const embed = buildEmbed(configService, {
          description: 'Aucun utilisateur whitelisté.'
        });
        await interaction.reply({ embeds: [embed] });
        return;
      }

      const userList = whitelisted.map(w => `<@${w.user_id}>`).join('\n');
      const embed = buildEmbed(configService, {
        title: 'Whitelist du serveur',
        description: userList,
        fields: [
          {
            name: 'Total',
            value: `${whitelisted.length} utilisateur(s)`,
            inline: true
          }
        ]
      });
      await interaction.reply({ embeds: [embed] });
    }
  }
};
