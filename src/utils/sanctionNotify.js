const { SanctionTypes } = require('./actionKeys');
const { formatDurationFrench } = require('./time');

const buildSanctionDmContent = ({ guildName, sanctionType, reason, durationMs, muteMethod = null }) => {
  const safeReason = reason && String(reason).trim().length > 0 ? reason.trim() : 'Aucune raison fournie';
  const hasDuration = durationMs && durationMs > 0;
  const durationLabel = hasDuration ? formatDurationFrench(durationMs) : null;
  const durationPart = hasDuration ? ` pour **${durationLabel}**` : '';
  const reasonPart = `, pour la raison suivante : \`${safeReason}\``;

  switch (sanctionType) {
    case SanctionTypes.BAN:
      return hasDuration
        ? `Vous avez été **ban** sur \`${guildName}\` pour une durée de **${durationLabel}**, pour la raison suivante : \`${safeReason}\``
        : `Vous avez été **définitivement ban** sur \`${guildName}\` pour la raison suivante : \`${safeReason}\``;

    case SanctionTypes.TEMPBAN:
      return `Vous avez été **ban** sur \`${guildName}\` pour **${durationLabel || 'une durée limitée'}**, pour la raison suivante : \`${safeReason}\``;

    case SanctionTypes.BLACKLIST:
      return hasDuration
        ? `Vous avez été **blacklist** sur \`${guildName}\` pour une durée de **${durationLabel}**, pour la raison suivante : \`${safeReason}\``
        : `Vous avez été **définitivement blacklisté** sur \`${guildName}\` pour la raison suivante : \`${safeReason}\``;

    case SanctionTypes.TEMPBLACKLIST:
      return `Vous avez été **blacklist** sur \`${guildName}\` pour **${durationLabel || 'une durée limitée'}**, pour la raison suivante : \`${safeReason}\``;

    case SanctionTypes.MUTE:
      if (muteMethod === 'timeout') {
        return `Vous avez été **Timeout** sur \`${guildName}\`${durationPart}${reasonPart}`;
      }
      return `Vous avez été **mute** sur \`${guildName}\`${durationPart || ' de façon permanente'}${reasonPart}`;

    case SanctionTypes.TEMPMUTE:
      if (muteMethod === 'timeout') {
        return `Vous avez été **Timeout** sur \`${guildName}\`${durationPart || ' pour une durée limitée'}${reasonPart}`;
      }
      return `Vous avez été **tempmute** sur \`${guildName}\`${durationPart || ' pour une durée limitée'}${reasonPart}`;

    case SanctionTypes.WARN:
      return `Vous avez été **warn** sur \`${guildName}\` pour la raison suivante : \`${safeReason}\``;

    case SanctionTypes.KICK:
      return `Vous avez été **expulsé** du serveur \`${guildName}\` pour la raison suivante : \`${safeReason}\``;

    default:
      return `Vous avez reçu une sanction sur \`${guildName}\` pour la raison suivante : \`${safeReason}\``;
  }
};

const buildUnmuteDmContent = (guildName) =>
  `Vous avez de nouveau la permission de parler sur \`${guildName}\``;

const sendSanctionDm = async (targetUser, content) => {
  if (!targetUser || typeof targetUser.send !== 'function') {
    return false;
  }
  try {
    await targetUser.send({ content });
    return true;
  } catch (error) {
    console.warn(`[SANCTION-DM] MP impossible pour ${targetUser.id}: ${error.message}`);
    return false;
  }
};

module.exports = {
  buildSanctionDmContent,
  buildUnmuteDmContent,
  sendSanctionDm
};
