const { ActionKeys } = require('../../utils/actionKeys');
const { helpEntries } = require('../definitions/helpContent');
const { cloneHelpData } = require('../helpers/usageMessages');
const { createSanctionApplyCommand } = require('../helpers/createSanctionCommand');

const help = cloneHelpData(helpEntries.ban);

module.exports = createSanctionApplyCommand({
  standaloneSlash: true,
  slashName: 'ban',
  description: 'Bannir un membre',
  targetOptionDescription: 'Utilisateur à bannir',
  reasonOptionDescription: 'Raison du ban',
  durationOption: {
    mode: 'optional',
    description: 'Durée optionnelle (ex: 7d ou 12h). Laisser vide pour un ban permanent.'
  },
  actionKey: ActionKeys.BAN,
  prefixAliases: ['ban'],
  embedTitle: 'Ban appliqué',
  includeDurationInEmbed: true,
  apply: async ({ sanctionService, guild, targetUser, executorUser, reason, durationMs }) =>
    sanctionService.applyBan({ guild, targetUser, executorUser, reason, durationMs }),
  help
});
