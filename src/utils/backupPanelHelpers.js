const { ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder } = require('discord.js');
const { buildEmbed } = require('./embedFactory');
const { discordTimestamp } = require('./time');

const MAX_LISTED = 10;

const invokerSuffix = (userId) => `_${userId}`;

const parseInvokerFromCustomId = (customId) => {
  if (!customId || !customId.startsWith('backup_')) {
    return null;
  }
  const match = customId.match(/_(\d{17,20})$/);
  return match ? match[1] : null;
};

const buildBackupListText = (backups) => {
  if (!backups.length) {
    return 'Aucune sauvegarde.';
  }
  return backups
    .slice(0, MAX_LISTED)
    .map((backup, index) => {
      const date = backup.created instanceof Date
        ? discordTimestamp(backup.created, 'f')
        : '—';
      return `**${index + 1}.** \`${backup.filename}\` — ${backup.sizeKB} KB — ${date}`;
    })
    .join('\n');
};

const buildBackupPanelEmbed = (configService, backupService, notice = null) => {
  const stats = backupService.getStats();
  const backups = backupService.listBackups();
  const lastBackup = stats.lastBackup instanceof Date
    ? discordTimestamp(stats.lastBackup, 'R')
    : stats.lastBackup;

  const embed = buildEmbed(configService, {
    title: 'Sauvegardes',
    description: notice || 'Gestion des backups de la base de données.',
    fields: [
      {
        name: 'Santé',
        value: [
          `• Statut : ${stats.backupEnabled ? 'activé' : 'désactivé'}`,
          `• Intervalle auto : ${stats.backupInterval}`,
          `• Stockage : ${stats.backupCount}/${stats.maxBackups} fichier(s) — ${stats.totalSize}`,
          `• Dernier backup : ${lastBackup}`
        ].join('\n'),
        inline: false
      },
      {
        name: `Liste (${Math.min(backups.length, MAX_LISTED)} affichée(s))`,
        value: buildBackupListText(backups),
        inline: false
      }
    ]
  });

  return embed;
};

const buildDelSelectOptions = (backups) =>
  backups.slice(0, MAX_LISTED).map((backup, index) => ({
    label: `#${index + 1} — ${backup.sizeKB} KB`,
    value: String(index + 1),
    description: backup.filename.length > 100 ? backup.filename.slice(0, 97) + '...' : backup.filename
  }));

const buildBackupPanelComponents = (userId, mode = 'main', backups = []) => {
  const suffix = invokerSuffix(userId);

  if (mode === 'clear_confirm') {
    return [
      new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`backup_clear_confirm${suffix}`)
          .setLabel('Confirmer la suppression')
          .setStyle(ButtonStyle.Danger),
        new ButtonBuilder()
          .setCustomId(`backup_clear_cancel${suffix}`)
          .setLabel('Annuler')
          .setStyle(ButtonStyle.Secondary)
      )
    ];
  }

  const rows = [
    new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`backup_now${suffix}`)
        .setLabel('Now')
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId(`backup_del${suffix}`)
        .setLabel('Del')
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId(`backup_clear${suffix}`)
        .setLabel('Clear')
        .setStyle(ButtonStyle.Danger)
    )
  ];

  if (mode === 'del_select' && backups.length > 0) {
    rows.push(
      new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder()
          .setCustomId(`backup_del_pick${suffix}`)
          .setPlaceholder('Choisir le numéro à supprimer')
          .addOptions(buildDelSelectOptions(backups))
      )
    );
  }

  return rows;
};

const assertBackupInvoker = async (interaction) => {
  const invokerId = parseInvokerFromCustomId(interaction.customId);
  if (!invokerId || interaction.user.id === invokerId) {
    return true;
  }

  const payload = {
    content: 'Seul l’utilisateur qui a ouvert ce panneau peut l’utiliser.',
    ephemeral: true
  };

  if (interaction.replied || interaction.deferred) {
    await interaction.followUp(payload).catch(() => {});
  } else {
    await interaction.reply(payload).catch(() => {});
  }
  return false;
};

module.exports = {
  MAX_LISTED,
  parseInvokerFromCustomId,
  buildBackupPanelEmbed,
  buildBackupPanelComponents,
  buildDelSelectOptions,
  assertBackupInvoker
};
