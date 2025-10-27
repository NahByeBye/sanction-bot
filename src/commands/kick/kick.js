const { ActionKeys } = require('../../utils/actionKeys');
const { helpEntries } = require('../definitions/helpContent');
const { cloneHelpData } = require('../helpers/usageMessages');
const { createSanctionApplyCommand } = require('../helpers/createSanctionCommand');

const help = cloneHelpData(helpEntries.kick);

module.exports = createSanctionApplyCommand({
  standaloneSlash: true,
  slashName: 'kick',
  description: 'Expulser un membre du serveur',
  targetOptionDescription: 'Utilisateur à expulser',
  reasonOptionDescription: "Raison de l'expulsion",
  durationOption: { mode: 'none' },
  actionKey: ActionKeys.KICK,
  prefixAliases: ['kick'],
  embedTitle: 'Kick appliqué',
  includeDurationInEmbed: false,
  apply: async ({ sanctionService, guild, targetUser, executorUser, reason }) =>
    sanctionService.applyKick({ guild, targetUser, executorUser, reason }),
  help
});
