const { ActionKeys } = require('../../utils/actionKeys');
const { buildEmbed } = require('../../utils/embedFactory');
const { formatDuration, discordTimestamp } = require('../../utils/time');
const { helpEntries } = require('../definitions/helpContent');
const { cloneHelpData, buildUsageResponse } = require('../helpers/usageMessages');

const help = cloneHelpData(helpEntries.infosanction || {
  key: 'infosanction',
  label: 'Info Sanction',
  category: 'history',
  description: 'Affiche les détails complets d\'une sanction pour un utilisateur.',
  usage: {
    prefix: '&infosanction <sanction_id> <@utilisateur>'
  },
  examples: {
    prefix: '&infosanction 2 @Toto'
  },
  notes: [
    'Utilise le Sanction ID affiché dans &sanctions (numéro propre au membre, ex. #2).'
  ]
});

const buildSanctionDetailEmbed = (configService, sanction, events = [], requester = null, requestTs = null, memberIndex = null) => {
  const duration = sanction.duration_ms ? formatDuration(sanction.duration_ms) : '';
  const createdDate = discordTimestamp(sanction.created_at, 'f');
  const expiresDate = sanction.expires_at ? `\nExpire : ${discordTimestamp(sanction.expires_at, 'R')}` : '';
  const typeLine = duration ? `${sanction.type} (${duration})` : sanction.type;

  const fields = [
    {
      name: 'Type',
      value: typeLine,
      inline: true
    },
    {
      name: 'Raison',
      value: sanction.reason || 'N/A',
      inline: true
    },
    {
      name: 'Date',
      value: `${createdDate}${expiresDate}`,
      inline: true
    },
    {
      name: 'Appliquée par',
      value: `<@${sanction.executor_id}>`,
      inline: true
    },
    {
      name: 'Utilisateur sanctionné',
      value: sanction.target_tag || `<@${sanction.target_id}>`,
      inline: true
    }
  ];

  if (events && events.length > 0) {
    const eventList = events
      .map(e => `• ${e.action} par <@${e.actor_id}> ${discordTimestamp(e.timestamp, 'R')}`)
      .join('\n');
    fields.push({ name: 'Événements', value: eventList, inline: false });
  }

  let footer = null;
  if (requester) {
    const rlDt = requestTs ? new Date(requestTs) : new Date();
    const sameDay = new Date().toDateString() === rlDt.toDateString();
    const hh = _twoDigits(rlDt.getHours());
    const mm = _twoDigits(rlDt.getMinutes());
    const timeStr = sameDay ? `Aujourd'hui à ${hh}:${mm}` : rlDt.toLocaleString('fr-FR');
    footer = {
      text: `Requête effectuée par ${requester.tag} • ${timeStr}`,
      icon_url: requester.displayAvatarURL ? requester.displayAvatarURL() : null
    };
  }

  const title = memberIndex
    ? `Informations — Sanction ID #${memberIndex}`
    : 'Informations sur la sanction';

  return buildEmbed(configService, {
    title,
    fields,
    footer
  });
};

function _twoDigits(n) {
  return n < 10 ? `0${n}` : `${n}`;
}

module.exports = {
  prefix: {
    aliases: ['infosanction', 'sanctioninfo', 'sinfo']
  },
  handlePrefix: async ({ message, args, registry, sanctionService, configService }) => {
    const commandPrefix = configService.getPrefix();
    const sanctionIdStr = args.shift();
    const userMention = args.shift();

    if (!sanctionIdStr || !userMention) {
      await message.reply(
        buildUsageResponse(`Usage: ${commandPrefix}infosanction <id> <@user>`, help, 'prefix', commandPrefix, true)
      );
      return;
    }

    const memberIndex = parseInt(sanctionIdStr, 10);
    if (isNaN(memberIndex) || memberIndex < 1) {
      await message.reply(buildUsageResponse('L\'ID doit être un nombre (sanction du membre, ex. 1, 2, 3).', help, 'prefix', commandPrefix, true));
      return;
    }

    const userId = registry.extractUserId(userMention);
    if (!userId) {
      await message.reply(buildUsageResponse('Utilisateur invalide.', help, 'prefix', commandPrefix, true));
      return;
    }

    const guild = message.guild;
    if (!guild) {
      return;
    }

    const sanction = sanctionService.getSanctionByMemberIndex(guild.id, userId, memberIndex);
    if (!sanction) {
      await message.reply(
        buildUsageResponse(`Sanction ID #${memberIndex} introuvable pour cet utilisateur.`, help, 'prefix', commandPrefix, true)
      );
      return;
    }

    const events = sanctionService.getSanctionEvents(sanction.id);
    const embed = buildSanctionDetailEmbed(
      configService,
      sanction,
      events,
      message.author,
      message.createdAt,
      memberIndex
    );
    await message.reply({ embeds: [embed] });
  },
  actionKey: ActionKeys.LIST,
  help
};
