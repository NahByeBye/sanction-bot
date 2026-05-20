const { buildEmbed } = require('./embedFactory');
const { formatDurationFrench } = require('./time');

/** Caractères Unicode (pas des emojis Discord). */
const SUCCESS_CHECK = '\u2713';
const ERROR_CROSS = '\u2717';

const SANCTION_ERROR_CODES = {
  ALREADY_MUTED: 'ALREADY_MUTED',
  ALREADY_BANNED: 'ALREADY_BANNED',
  ALREADY_BLACKLISTED: 'ALREADY_BLACKLISTED'
};

const INTERNAL_REVOKE_REASON = 'Levée manuelle';

const buildSuccessEmbed = (configService, body) =>
  buildEmbed(configService, {
    description: `${SUCCESS_CHECK} ${body}`,
    timestamp: false,
    suppressFooter: true
  });

const buildBanSuccessEmbed = (configService, targetUserId, reason) =>
  buildSuccessEmbed(
    configService,
    `Vous avez banni <@${targetUserId}> pour **${reason}**`
  );

const buildBlacklistSuccessEmbed = (configService, targetUserId, reason) =>
  buildSuccessEmbed(
    configService,
    `Vous avez BL <@${targetUserId}> pour **${reason}**`
  );

const buildUnblacklistSuccessEmbed = (configService, targetUserId) =>
  buildSuccessEmbed(
    configService,
    `Vous avez retiré <@${targetUserId}> de la BL.`
  );

const buildUnbanSuccessEmbed = (configService, targetUserId) =>
  buildSuccessEmbed(
    configService,
    `<@${targetUserId}> n'est plus banni.`
  );

const buildUnmuteSuccessEmbed = (configService, targetUserId) =>
  buildSuccessEmbed(
    configService,
    `Vous avez retiré le mute de <@${targetUserId}> .`
  );

const buildMuteSuccessEmbed = (configService, targetUserId, reason, record) => {
  const durationMs = record?.duration_ms;
  const durationPart = durationMs ? ` pour **${formatDurationFrench(durationMs)}**` : '';
  return buildSuccessEmbed(
    configService,
    `Vous avez mute <@${targetUserId}>${durationPart} — **${reason}**`
  );
};

const buildKickSuccessEmbed = (configService, targetUserId, reason) =>
  buildSuccessEmbed(
    configService,
    `Vous avez expulsé <@${targetUserId}> pour **${reason}**`
  );

const buildClearSanctionsSuccessEmbed = (configService, targetUserId, count, reason) =>
  buildSuccessEmbed(
    configService,
    `Vous avez effacé **${count}** sanction(s) de <@${targetUserId}> — **${reason}**`
  );

const buildCommandErrorEmbed = (configService, message) => {
  const text = message?.endsWith('.') || message?.endsWith('?') ? message : `${message}.`;
  return buildEmbed(configService, {
    description: `${ERROR_CROSS}  ${text}`,
    timestamp: false,
    suppressFooter: true
  });
};

const buildAlreadyMutedEmbed = (configService) =>
  buildCommandErrorEmbed(configService, 'Cet utilisateur est déjà mute');

const buildAlreadyBannedEmbed = (configService) =>
  buildCommandErrorEmbed(configService, 'Cet utilisateur est déjà banni.');

const buildAlreadyBlacklistedEmbed = (configService) =>
  buildCommandErrorEmbed(configService, 'Cet utilisateur est déjà blacklisté.');

const isAlreadyMutedError = (error) =>
  error?.code === SANCTION_ERROR_CODES.ALREADY_MUTED;

const isAlreadyBannedError = (error) =>
  error?.code === SANCTION_ERROR_CODES.ALREADY_BANNED;

const isAlreadyBlacklistedError = (error) =>
  error?.code === SANCTION_ERROR_CODES.ALREADY_BLACKLISTED;

const createAlreadyMutedError = () => {
  const error = new Error('Cet utilisateur est déjà mute.');
  error.code = SANCTION_ERROR_CODES.ALREADY_MUTED;
  return error;
};

const createAlreadyBannedError = () => {
  const error = new Error('Cet utilisateur est déjà banni.');
  error.code = SANCTION_ERROR_CODES.ALREADY_BANNED;
  return error;
};

const createAlreadyBlacklistedError = () => {
  const error = new Error('Cet utilisateur est déjà blacklisté.');
  error.code = SANCTION_ERROR_CODES.ALREADY_BLACKLISTED;
  return error;
};

module.exports = {
  SUCCESS_CHECK,
  ERROR_CROSS,
  SANCTION_ERROR_CODES,
  INTERNAL_REVOKE_REASON,
  buildCommandErrorEmbed,
  buildAlreadyMutedEmbed,
  buildAlreadyBannedEmbed,
  buildAlreadyBlacklistedEmbed,
  isAlreadyMutedError,
  isAlreadyBannedError,
  isAlreadyBlacklistedError,
  createAlreadyMutedError,
  createAlreadyBannedError,
  createAlreadyBlacklistedError,
  buildBanSuccessEmbed,
  buildBlacklistSuccessEmbed,
  buildUnblacklistSuccessEmbed,
  buildUnbanSuccessEmbed,
  buildUnmuteSuccessEmbed,
  buildMuteSuccessEmbed,
  buildKickSuccessEmbed,
  buildClearSanctionsSuccessEmbed
};
