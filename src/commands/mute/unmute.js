const { ActionKeys, SanctionTypes } = require('../../utils/actionKeys');

const { helpEntries } = require('../definitions/helpContent');

const { cloneHelpData, replyCommandError } = require('../helpers/usageMessages');

const { buildEmbed } = require('../../utils/embedFactory');

const { buildUnmuteSuccessEmbed } = require('../../utils/sanctionSuccessEmbeds');



const help = cloneHelpData(helpEntries.unmute);



const INTERNAL_REVOKE_REASON = 'Levée manuelle';



module.exports = {

  description: 'Retirer le mute d\'un membre',

  actionKey: ActionKeys.UNMUTE,

  prefix: {

    aliases: ['unmute']

  },

  help,

  handlePrefix: async ({ message, args, registry, sanctionService, configService }) => {

    const guild = message.guild;

    if (!guild) {

      return;

    }



    const executorMember = message.member;

    const commandPrefix = configService.getPrefix();



    const target = await registry.resolveCommandTarget(message, args);

    if (target.error) {

      await message.reply(replyCommandError(configService, target.error, commandPrefix));

      return;

    }

    const userId = target.userId;



    const guard = await registry.runActionWithGuards({

      source: message,

      actionKey: ActionKeys.UNMUTE,

      commandKey: help.key,

      executorMember,

      message,

      reason: ''

    });



    if (guard.blocked) {

      return;

    }



    const targetUser = await message.client.users.fetch(userId).catch(() => null);

    if (!targetUser) {

      await message.reply(replyCommandError(configService, 'Utilisateur introuvable.', commandPrefix));

      return;

    }



    // Trouver une sanction MUTE ou TEMPMUTE

    const sanction = sanctionService.findActiveSanction(guild.id, userId, [SanctionTypes.MUTE, SanctionTypes.TEMPMUTE]);

    if (!sanction) {

      await message.reply(replyCommandError(configService, 'Aucun tempmute actif trouvé.', commandPrefix));

      return;

    }



    // Vérifier que c'était un mute rôle (pas un timeout)

    const events = sanctionService.getSanctionEvents(sanction.id);

    const appliedEvent = events.find(e => e.action === 'APPLIED');

    let isRoleMute = false;

    if (appliedEvent?.metadata) {

      try {

        const meta = JSON.parse(appliedEvent.metadata);

        isRoleMute = meta.muteMethod === 'role';

      } catch (e) {

        // Si pas de metadata, on assume que c'est un mute rôle si le type est MUTE

      }

    }



    // Si le type est MUTE (permanent), c'est forcément un rôle

    if (sanction.type === SanctionTypes.MUTE) {

      isRoleMute = true;

    }



    // Si c'est TEMPMUTE sans metadata, vérifier si le membre a le rôle Mute

    if (!isRoleMute && sanction.type === SanctionTypes.TEMPMUTE) {

      const muteRoleId = sanctionService.db.getGuildRole(guild.id, 'MUTE');

      const member = await guild.members.fetch(userId).catch(() => null);

      if (muteRoleId && member && member.roles.cache.has(muteRoleId)) {

        isRoleMute = true;

      }

    }



    if (!isRoleMute) {

      await message.reply(replyCommandError(configService, 'Aucun tempmute actif trouvé.', commandPrefix));

      return;

    }



    const reason = INTERNAL_REVOKE_REASON;



    try {

      await sanctionService.revokeMute({ guild, sanction, executorUser: message.author, reason });



      const embed = buildUnmuteSuccessEmbed(configService, userId);

      await message.reply({ embeds: [embed] });

    } catch (error) {

      await message.reply(replyCommandError(configService, error.message, commandPrefix));

    }

  }

};

