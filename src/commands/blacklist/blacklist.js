const { ActionKeys } = require('../../utils/actionKeys');
const { helpEntries } = require('../definitions/helpContent');
const { cloneHelpData } = require('../helpers/usageMessages');
const { createSanctionApplyCommand } = require('../helpers/createSanctionCommand');

const help = cloneHelpData(helpEntries.blacklist);

module.exports = createSanctionApplyCommand({
  standaloneSlash: true,
  slashName: 'blacklist',
  description: 'Blacklist un utilisateur du bot',
  targetOptionDescription: 'Utilisateur à blacklist',
  reasonOptionDescription: 'Raison du blacklist',
  durationOption: { mode: 'none' },
  actionKey: ActionKeys.BLACKLIST,
  prefixAliases: ['blacklist', 'bl'],
  embedTitle: 'Blacklist appliquée',
  includeDurationInEmbed: false,
  apply: async ({ sanctionService, guild, targetUser, executorUser, reason }) =>
    sanctionService.applyBlacklist({ guild, targetUser, executorUser, reason }),
  help
});
