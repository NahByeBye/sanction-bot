const { ActionKeys } = require('../../utils/actionKeys');
const { helpEntries } = require('../definitions/helpContent');
const { cloneHelpData, replyCommandError } = require('../helpers/usageMessages');
const { buildEmbed } = require('../../utils/embedFactory');

const help = cloneHelpData(helpEntries.baninfo || {
  key: 'baninfo',
  label: 'Ban Info',
  category: 'sanctions',
  description: 'Afficher les informations sur un bannissement',
  usage: { prefix: '&baninfo <utilisateur>' },
  examples: { prefix: '&baninfo @utilisateur' }
});

module.exports = {
  prefix: { aliases: ['baninfo'] },
  handlePrefix: async ({ message, args, registry, db, configService, sanctionService }) => {
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

    const canBan = await registry.permissionService.canExecute(executorMember, ActionKeys.BAN);
    const canBlacklist = await registry.permissionService.canExecute(executorMember, ActionKeys.BLACKLIST);

    if (!canBan && !canBlacklist && !registry.permissionService.isOwner(executorMember.id)) {
      await message.reply(replyCommandError(configService, "Vous n'avez pas la permission d'exécuter cette action", commandPrefix));
      return;
    }

    const targetUser = await message.client.users.fetch(userId).catch(() => null);
    if (!targetUser) {
      await message.reply(replyCommandError(configService, 'Utilisateur introuvable.', commandPrefix));
      return;
    }

    try {
      const sanctions = db.listSanctions(guild.id, userId, 1, 0);
      const ban = sanctions.find(s => s.type === 'BAN' || s.type === 'TEMPBAN');
      
      if (!ban) {
        const blacklist = sanctions.find(s => s.type === 'BLACKLIST' || s.type === 'TEMPBLACKLIST');
        if (blacklist) {
          const executorUser = await message.client.users.fetch(blacklist.executor_id).catch(() => null);
          const byOwner = sanctionService.wasBlacklistedByOwner(blacklist);
          const embed = {
            color: parseInt(configService.get('color').replace('#', ''), 16),
            title: 'Informations sur le Bannissement',
            fields: [
              {
                name: '👤 Utilisateur :',
                value: `\`\`\`\nNom d'utilisateur : ${targetUser.username}\nIdentifiant : ${targetUser.id}\n\`\`\``,
                inline: false
              },
              {
                name: '📄 Informations :',
                value: `\`\`\`\nRaison : ${blacklist.reason || '-'} [BL${byOwner ? ' par Sys+' : ''}]\n\`\`\``,
                inline: false
              },
              {
                name: '🧑‍✈️ Modérateur :',
                value: `\`\`\`\n❌\n\`\`\``,
                inline: false
              },
              {
                name: '📅 Date :',
                value: `<t:${Math.floor(blacklist.created_at / 1000)}:F>`,
                inline: false
              }
            ],
          };
          await message.reply({ embeds: [embed] });
          return;
        }
        
        const embed = {
          color: parseInt(configService.get('color').replace('#', ''), 16),
          description: '✗ Aucun bannissement trouvé pour cet utilisateur.'
        };
        await message.reply({ embeds: [embed] });
        return;
      }

      const isBlacklisted = sanctions.some(s => s.type === 'BLACKLIST' || s.type === 'TEMPBLACKLIST');
      const executorUser = await message.client.users.fetch(ban.executor_id).catch(() => null);
      const date = new Date(ban.created_at);
      const formattedDate = date.toLocaleDateString('fr-FR', { 
        weekday: 'long', 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });

      const embed = {
        color: parseInt(configService.get('color').replace('#', ''), 16),
        title: 'Informations sur le Bannissement',
        fields: [
          {
            name: '👤 Utilisateur :',
            value: `\`\`\`\nNom d'utilisateur : ${targetUser.username}\nIdentifiant : ${targetUser.id}\n\`\`\``,
            inline: false
          },
          {
            name: '📄 Informations :',
            value: `\`\`\`\nRaison : ${ban.reason}\n\`\`\``,
            inline: false
          },
          {
            name: '🧑‍✈️ Modérateur :',
            value: isBlacklisted ? `\`\`\`\n❌\n\`\`\`` : `\`\`\`\nNom d'utilisateur : ${executorUser?.username || 'Inconnu'}\nIdentifiant : ${ban.executor_id}\n\`\`\``,
            inline: false
          },
          {
            name: '📅 Date :',
            value: `<t:${Math.floor(ban.created_at / 1000)}:F>`,
            inline: false
          }
        ],
      };

      await message.reply({ embeds: [embed] });
    } catch (error) {
      await message.reply(replyCommandError(configService, error.message, commandPrefix));
    }
  },
  actionKey: null,
  help
};
