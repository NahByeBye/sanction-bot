const { MessageFlags } = require('discord.js');
const {
  buildBackupPanelEmbed,
  buildBackupPanelComponents,
  assertBackupInvoker
} = require('../../utils/backupPanelHelpers');

const ensureBackupAccess = async (member, registry) => {
  if (await registry.ensureOwnerPermissions(member)) {
    return true;
  }
  return false;
};

const sendBackupPanel = async (target, configService, backupService, userId, notice = null) => {
  const backups = backupService.listBackups();
  const embed = buildBackupPanelEmbed(configService, backupService, notice);
  const components = buildBackupPanelComponents(userId, 'main', backups);
  return target.reply({ embeds: [embed], components });
};

const refreshBackupPanel = async (interaction, configService, backupService, userId, notice = null, mode = 'main') => {
  const payload = {
    embeds: [buildBackupPanelEmbed(configService, backupService, notice)],
    components: buildBackupPanelComponents(userId, mode, backupService.listBackups())
  };
  if (interaction.deferred) {
    return interaction.editReply(payload);
  }
  return interaction.update(payload);
};

const handleBackupNow = async (interaction, backupService, configService, userId) => {
  await interaction.deferUpdate();
  const result = await backupService.performBackup();
  const notice = result
    ? `Backup créé : \`${result.filename}\` (${(result.size / 1024).toFixed(2)} KB).`
    : 'Backup ignoré (déjà en cours).';
  await refreshBackupPanel(interaction, configService, backupService, userId, notice);
};

const handleBackupDelete = async (interaction, backupService, configService, userId) => {
  const backups = backupService.listBackups();
  if (!backups.length) {
    await interaction.reply({ content: 'Aucune sauvegarde à supprimer.', flags: MessageFlags.Ephemeral });
    return;
  }
  await interaction.update({
    embeds: [buildBackupPanelEmbed(configService, backupService, 'Choisissez le numéro à supprimer.')],
    components: buildBackupPanelComponents(userId, 'del_select', backups)
  });
};

const handleBackupDeletePick = async (interaction, backupService, configService, userId) => {
  const index = Number(interaction.values[0]);
  const removed = backupService.deleteBackupAtIndex(index);
  await refreshBackupPanel(
    interaction,
    configService,
    backupService,
    userId,
    `Backup **#${index}** supprimé : \`${removed.filename}\`.`
  );
};

const handleBackupClear = async (interaction, backupService, configService, userId) => {
  const backups = backupService.listBackups();
  if (!backups.length) {
    await interaction.reply({ content: 'Aucune sauvegarde à effacer.', flags: MessageFlags.Ephemeral });
    return;
  }
  await refreshBackupPanel(
    interaction,
    configService,
    backupService,
    userId,
    `⚠️ Supprimer **toutes** les sauvegardes (${backups.length}) ?`,
    'clear_confirm'
  );
};

const handleBackupClearConfirm = async (interaction, backupService, configService, userId) => {
  const count = backupService.clearAllBackups();
  await refreshBackupPanel(
    interaction,
    configService,
    backupService,
    userId,
    `${count} sauvegarde(s) supprimée(s).`
  );
};

const handleBackupClearCancel = async (interaction, configService, backupService, userId) => {
  await refreshBackupPanel(interaction, configService, backupService, userId);
};

const actionHandlers = {
  'backup_now': handleBackupNow,
  'backup_del': handleBackupDelete,
  'backup_del_pick': handleBackupDeletePick,
  'backup_clear': handleBackupClear,
  'backup_clear_confirm': handleBackupClearConfirm,
  'backup_clear_cancel': handleBackupClearCancel
};

module.exports = {
  prefix: {
    aliases: ['backup']
  },
  handlePrefix: async ({ message, registry, backupService, configService }) => {
    if (!(await ensureBackupAccess(message.member, registry))) {
      await message.reply("Vous n'avez pas la permission d'utiliser cette commande.");
      return;
    }

    try {
      await sendBackupPanel(message, configService, backupService, message.author.id);
    } catch (error) {
      console.error('backup error:', error);
      await message.reply(`Erreur: ${error.message}`);
    }
  },
  handleBackupInteraction: async (interaction, { registry, backupService, configService }) => {
    const customId = interaction.customId;
    if (!customId.startsWith('backup_')) {
      return false;
    }

    if (!(await assertBackupInvoker(interaction))) {
      return true;
    }

    if (!(await ensureBackupAccess(interaction.member, registry))) {
      await interaction.reply({
        content: "Vous n'avez pas la permission d'utiliser ce panneau.",
        flags: MessageFlags.Ephemeral
      });
      return true;
    }

    const userId = interaction.user.id;
    const backups = backupService.listBackups();

    try {
      const actionKey = customId.replace(`_${userId}`, '').replace('backup_', '');
      const handler = actionHandlers[actionKey];

      if (handler) {
        if (actionKey === 'backup_del_pick' && !interaction.isStringSelectMenu()) {
          return false;
        }
        await handler(interaction, backupService, configService, userId);
        return true;
      }

      return false;
    } catch (error) {
      console.error('backup interaction error:', error);
      const payload = { content: `Erreur: ${error.message}`, flags: MessageFlags.Ephemeral };
      if (interaction.deferred || interaction.replied) {
        await interaction.followUp(payload).catch(() => {});
      } else {
        await interaction.reply(payload).catch(() => {});
      }
      return true;
    }
  },
  help: {
    key: 'backup',
    label: 'Backup',
    category: 'owners',
    description: 'Panneau de gestion des sauvegardes (liste, création, suppression).',
    usage: { prefix: '&backup' },
    examples: { prefix: '&backup' },
    notes: ['Boutons Now / Del / Clear sur le panneau interactif.']
  }
};
