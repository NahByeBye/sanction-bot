const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { parseDuration } = require('../../utils/time');
const { buildEmbed } = require('../../utils/embedFactory');

const data = new SlashCommandBuilder()
  .setName('punition')
  .setDescription('Appliquer une punition à un utilisateur (owner only)')
  .addUserOption(option =>
    option
      .setName('utilisateur')
      .setDescription('L\'utilisateur à punir')
      .setRequired(true)
  )
  .addStringOption(option =>
    option
      .setName('durée')
      .setDescription('Durée de la punition (ex: 12h, 3j, 7j, 14j)')
      .setRequired(true)
  )
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator);

const handleSlash = async ({ interaction, db, configService, permissionService }) => {
  if (!permissionService.isOwner(interaction.user.id)) {
    await interaction.reply({
      content: 'Cette commande est réservée aux owners.',
      ephemeral: true
    });
    return;
  }

  const targetUser = interaction.options.getUser('utilisateur');
  const durationStr = interaction.options.getString('durée');

  if (permissionService.isOwner(targetUser.id)) {
    await interaction.reply({
      content: 'Tu ne peux pas punir un autre owner.',
      ephemeral: true
    });
    return;
  }

  const parsed = parseDuration(durationStr);
  if (!parsed.milliseconds) {
    await interaction.reply({
      content: 'Durée invalide. Exemples: 12h, 3j, 7j, 14j',
      ephemeral: true
    });
    return;
  }

  try {
    db.addPunishment(targetUser.id, interaction.user.id, parsed.milliseconds);

    const expiresAt = Date.now() + parsed.milliseconds;
    const expiresTimestamp = Math.floor(expiresAt / 1000);

    const embed = buildEmbed(configService, {
      description: `✓ <@${targetUser.id}> a été puni pendant ${durationStr}.\n\nLa punition expire: <t:${expiresTimestamp}:F>\n\n**Actions bloquées:** Ban, Blacklist, Unblacklist\n**Actions autorisées:** Unban`
    });

    await interaction.reply({ embeds: [embed] });

    try {
      const dmEmbed = new (require('discord.js')).EmbedBuilder()
        .setColor(parseInt(configService.get('color').replace('#', ''), 16))
        .setDescription(`Tu as été puni sur **${interaction.guild.name}** pour une durée de **${durationStr}**.\nTu vas devoir être sage désormais et tu es obligé d'attendre la fin de cette durée.`)
        .setFooter({ text: configService.get('footer') });
      
      await targetUser.send({ embeds: [dmEmbed] });
    } catch (dmError) {
      console.error('dm error:', dmError.message);
    }
  } catch (error) {
    await interaction.reply({
      content: `Erreur: ${error.message}`,
      ephemeral: true
    });
  }
};

module.exports = {
  data,
  handleSlash
};
