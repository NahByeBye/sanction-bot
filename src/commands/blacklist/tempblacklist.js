const { ActionKeys } = require('../../utils/actionKeys');
const { helpEntries } = require('../definitions/helpContent');
const { cloneHelpData } = require('../helpers/usageMessages');
const { createSanctionApplyCommand } = require('../helpers/createSanctionCommand');

const help = cloneHelpData(helpEntries.tempblacklist);

module.exports = createSanctionApplyCommand({
  standaloneSlash: true,
  slashName: 'tempblacklist',
  description: 'Blacklist temporaire du bot',
  targetOptionDescription: 'Utilisateur à blacklist',
  reasonOptionDescription: 'Raison du blacklist temporaire',
  durationOption: {
    mode: 'required',
    description: 'Durée de la blacklist temporaire (ex: 7d, 12h).'
  },
  actionKey: ActionKeys.TEMPBLACKLIST,
  prefixAliases: ['tempblacklist', 'tempbl', 'tbl'],
  embedTitle: 'Blacklist temporaire appliquée',
  includeDurationInEmbed: true,
  durationErrorMessage: 'Veuillez préciser une durée valide pour la blacklist temporaire (ex: 7d, 12h).',
  apply: async ({ sanctionService, guild, targetUser, executorUser, reason, durationMs }) =>
    sanctionService.applyBlacklist({ guild, targetUser, executorUser, reason, durationMs }),
  help
});
