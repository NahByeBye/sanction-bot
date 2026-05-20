const { ActionKeys } = require('../../utils/actionKeys');
const { helpEntries } = require('../definitions/helpContent');
const { cloneHelpData } = require('../helpers/usageMessages');
const { createSanctionApplyCommand } = require('../helpers/createSanctionCommand');

const help = cloneHelpData(helpEntries.ban);

module.exports = createSanctionApplyCommand({
  description: 'Bannir un membre',
  durationOption: {
    mode: 'optional',
    description: 'Durée optionnelle (ex: 60s, 30m, 24h, 7j). Vide = permanent.'
  },
  actionKey: ActionKeys.BAN,
  prefixAliases: ['ban'],
  embedTitle: 'Ban appliqué',
  applySuccessStyle: 'ban',
  includeDurationInEmbed: true,
  apply: async ({ sanctionService, guild, targetUser, executorUser, reason, durationMs }) =>
    sanctionService.applyBan({ guild, targetUser, executorUser, reason, durationMs }),
  help
});
