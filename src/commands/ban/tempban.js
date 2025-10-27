const { ActionKeys } = require('../../utils/actionKeys');
const { helpEntries } = require('../definitions/helpContent');
const { cloneHelpData } = require('../helpers/usageMessages');
const { createSanctionApplyCommand } = require('../helpers/createSanctionCommand');

const help = cloneHelpData(helpEntries.tempban);

module.exports = createSanctionApplyCommand({
  standaloneSlash: true,
  slashName: 'tempban',
  description: 'Bannir temporairement un membre',
  targetOptionDescription: 'Utilisateur à bannir',
  reasonOptionDescription: 'Raison du tempban',
  durationOption: {
    mode: 'required',
    description: 'Durée du ban temporaire (ex: 7d ou 12h).'
  },
  actionKey: ActionKeys.TEMPBAN,
  prefixAliases: ['tempban', 'tban'],
  embedTitle: 'TempBan appliqué',
  includeDurationInEmbed: true,
  durationErrorMessage: 'Veuillez préciser une durée valide pour le tempban (ex: 7d, 12h).',
  apply: async ({ sanctionService, guild, targetUser, executorUser, reason, durationMs }) =>
    sanctionService.applyBan({ guild, targetUser, executorUser, reason, durationMs }),
  help
});
