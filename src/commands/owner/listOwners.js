const { buildEmbed } = require('../../utils/embedFactory');
const { helpEntries } = require('../definitions/helpContent');

const formatOwners = (owners) =>
  owners
    .map((owner) => `${owner.is_primary ? '⭐' : '•'} <@${owner.user_id}> (ajouté le ${new Date(owner.added_at).toLocaleString()})`)
    .join('\n');

module.exports = {
  slashParent: 'owner',
  slashName: 'liste',
  registerSlash: (sub) => sub.setName('liste').setDescription('Lister les owners'),
  handleSlash: async ({ interaction, permissionService, registry, configService }) => {
    if (!(await registry.ensureOwnerPermissions(interaction.member))) {
      await interaction.reply({ content: 'Seuls les owners ou administrateurs peuvent gérer cette commande.', ephemeral: true });
      return;
    }

    const owners = permissionService.listOwners();
    const description = owners.length > 0 ? formatOwners(owners) : 'Aucun owner enregistré.';
    await interaction.reply({
      embeds: [buildEmbed(configService, { title: 'Owners', description })],
      ephemeral: true
    });
  },
  prefix: {
    group: {
      baseAliases: ['owner'],
      triggers: ['liste', 'list'],
      default: true
    }
  },
  handlePrefix: async ({ message, permissionService, registry, configService }) => {
    if (!(await registry.ensureOwnerPermissions(message.member))) {
      await message.reply("Vous n'avez pas la permission d'utiliser cette commande.");
      return;
    }

    const owners = permissionService.listOwners();
    const description = owners.length > 0 ? formatOwners(owners) : 'Aucun owner enregistré.';
    await message.reply({ embeds: [buildEmbed(configService, { title: 'Owners', description })] });
  },
  help: helpEntries.ownerList
};
