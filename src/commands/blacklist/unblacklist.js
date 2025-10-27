const { ActionKeys, SanctionTypes } = require('../../utils/actionKeys');
const { helpEntries } = require('../definitions/helpContent');
const { cloneHelpData } = require('../helpers/usageMessages');
const { createSanctionRevokeCommand } = require('../helpers/createSanctionCommand');

const help = cloneHelpData(helpEntries.unblacklist);

module.exports = createSanctionRevokeCommand({
  standaloneSlash: true,
  slashName: 'unblacklist',
  description: "Retirer la blacklist d'un utilisateur",
  targetOptionDescription: 'Utilisateur à retirer de la blacklist',
  reasonOptionDescription: 'Raison du retrait de blacklist',
  actionKey: ActionKeys.UNBLACKLIST,
  prefixAliases: ['unblacklist', 'unbl'],
  embedTitle: 'Blacklist retirée',
  sanctionTypes: [SanctionTypes.BLACKLIST, SanctionTypes.TEMPBLACKLIST],
  revoke: async ({ sanctionService, guild, sanction, executorUser, reason }) =>
    sanctionService.revokeBlacklist({ guild, sanction, executorUser, reason }),
  help
});
