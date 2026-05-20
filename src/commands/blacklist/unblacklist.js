const { ActionKeys, SanctionTypes } = require('../../utils/actionKeys');
const { helpEntries } = require('../definitions/helpContent');
const { cloneHelpData } = require('../helpers/usageMessages');
const { createSanctionRevokeCommand } = require('../helpers/createSanctionCommand');

const help = cloneHelpData(helpEntries.unblacklist);

module.exports = createSanctionRevokeCommand({
  description: "Retirer la blacklist serveur et débannir l'utilisateur",
  actionKey: ActionKeys.UNBLACKLIST,
  prefixAliases: ['unblacklist', 'unbl'],
  embedTitle: 'Blacklist serveur retirée',
  revokeSuccessStyle: 'unblacklist',
  sanctionTypes: [SanctionTypes.BLACKLIST, SanctionTypes.TEMPBLACKLIST],
  revoke: async ({ sanctionService, guild, sanction, executorUser, reason }) =>
    sanctionService.revokeBlacklist({ guild, sanction, executorUser, reason }),
  help
});
