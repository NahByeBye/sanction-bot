const { ActionKeys } = require('../../utils/actionKeys');
const { helpEntries } = require('../definitions/helpContent');
const { cloneHelpData } = require('../helpers/usageMessages');
const { createSanctionApplyCommand } = require('../helpers/createSanctionCommand');

const help = cloneHelpData(helpEntries.tempmute);

module.exports = createSanctionApplyCommand({
  standaloneSlash: true,
  slashName: 'tempmute',
  description: 'Mute temporaire (timeout)',
  targetOptionDescription: 'Utilisateur à mute',
  reasonOptionDescription: 'Raison du mute',
  durationOption: {
    mode: 'required',
    description: 'Durée du mute temporaire (ex: 1h, 5d).'
  },
  actionKey: ActionKeys.TEMPMUTE,
  prefixAliases: ['tempmute', 'tmute'],
  embedTitle: 'TempMute appliqué',
  includeDurationInEmbed: true,
  durationErrorMessage: 'Veuillez préciser une durée valide pour le tempmute (ex: 30m, 2h).',
  apply: async ({ sanctionService, guild, targetUser, executorUser, reason, durationMs }) =>
    sanctionService.applyMute({ guild, targetUser, executorUser, reason, durationMs }),
  help
});
