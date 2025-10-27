const { ActionKeys, SanctionTypes } = require('../../utils/actionKeys');
const { helpEntries } = require('../definitions/helpContent');
const { cloneHelpData } = require('../helpers/usageMessages');
const { createSanctionRevokeCommand } = require('../helpers/createSanctionCommand');

const help = cloneHelpData(helpEntries.unmute);

module.exports = createSanctionRevokeCommand({
  standaloneSlash: true,
  slashName: 'unmute',
  description: 'Retirer le mute (timeout) d\'un membre',
  targetOptionDescription: 'Utilisateur à unmute',
  reasonOptionDescription: 'Raison du unmute',
  actionKey: ActionKeys.UNMUTE,
  prefixAliases: ['unmute'],
  embedTitle: 'Unmute appliqué',
  sanctionTypes: [SanctionTypes.MUTE, SanctionTypes.TEMPMUTE],
  revoke: async ({ sanctionService, guild, sanction, executorUser, reason }) =>
    sanctionService.revokeMute({ guild, sanction, executorUser, reason }),
  help
});
