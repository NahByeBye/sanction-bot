const { ActionKeys } = require('../../utils/actionKeys');
const { helpEntries } = require('../definitions/helpContent');
const { cloneHelpData } = require('../helpers/usageMessages');
const { createSanctionApplyCommand } = require('../helpers/createSanctionCommand');

const help = cloneHelpData(helpEntries.warn);

module.exports = createSanctionApplyCommand({
  standaloneSlash: true,
  slashName: 'warn',
  description: 'Avertir un membre',
  targetOptionDescription: 'Utilisateur à avertir',
  reasonOptionDescription: 'Raison du warn',
  durationOption: { mode: 'none' },
  actionKey: ActionKeys.WARN,
  prefixAliases: ['warn'],
  embedTitle: 'Warn appliqué',
  includeDurationInEmbed: false,
  apply: async ({ sanctionService, guild, targetUser, executorUser, reason }) =>
    sanctionService.applyWarn({ guild, targetUser, executorUser, reason }),
  help
});
