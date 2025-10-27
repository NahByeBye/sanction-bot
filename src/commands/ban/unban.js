const { ActionKeys, SanctionTypes } = require('../../utils/actionKeys');
const { helpEntries } = require('../definitions/helpContent');
const { cloneHelpData } = require('../helpers/usageMessages');
const { createSanctionRevokeCommand } = require('../helpers/createSanctionCommand');

const help = cloneHelpData(helpEntries.unban);

module.exports = createSanctionRevokeCommand({
  standaloneSlash: true,
  slashName: 'unban',
  description: 'Débannir un membre',
  targetOptionDescription: 'Utilisateur à débannir',
  reasonOptionDescription: "Raison de l'unban",
  actionKey: ActionKeys.UNBAN,
  prefixAliases: ['unban'],
  embedTitle: 'Unban appliqué',
  sanctionTypes: [SanctionTypes.BAN, SanctionTypes.TEMPBAN],
  revoke: async ({ sanctionService, guild, sanction, executorUser, reason }) =>
    sanctionService.revokeBan({ guild, sanction, executorUser, reason }),
  help
});
