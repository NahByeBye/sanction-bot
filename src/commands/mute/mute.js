const { ActionKeys } = require('../../utils/actionKeys');
const { helpEntries } = require('../definitions/helpContent');
const { cloneHelpData } = require('../helpers/usageMessages');
const { createSanctionApplyCommand } = require('../helpers/createSanctionCommand');

const help = cloneHelpData(helpEntries.mute);

module.exports = createSanctionApplyCommand({
  standaloneSlash: true,
  slashName: 'mute',
  description: 'Mute (timeout) un membre',
  targetOptionDescription: 'Utilisateur à mute',
  reasonOptionDescription: 'Raison du mute',
  durationOption: {
    mode: 'optional',
    description: 'Durée optionnelle (ex: 30m, 2h). Laisser vide pour appliquer la durée maximale.'
  },
  actionKey: ActionKeys.MUTE,
  prefixAliases: ['mute'],
  embedTitle: 'Mute appliqué',
  includeDurationInEmbed: true,
  apply: async ({ sanctionService, guild, targetUser, executorUser, reason, durationMs }) =>
    sanctionService.applyMute({ guild, targetUser, executorUser, reason, durationMs }),
  help
});
