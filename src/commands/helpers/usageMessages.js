const { buildCommandErrorEmbed } = require('../../utils/sanctionSuccessEmbeds');

const cloneHelpData = (help) => {
  if (!help) {
    return null;
  }
  return {
    ...help,
    usage: { ...(help.usage || {}) },
    examples: { ...(help.examples || {}) },
    notes: Array.isArray(help.notes) ? [...help.notes] : []
  };
};

const DEFAULT_PREFIX = '&';

const applyCommandPrefix = (text, commandPrefix) => {
  if (!text || !commandPrefix) {
    return text;
  }
  return text.replace(/&/g, commandPrefix);
};

const formatUsageLine = (help, type, field, label, commandPrefix) => {
  const value = help[field]?.[type];
  if (!value) {
    return null;
  }
  const formatted = type === 'prefix' ? applyCommandPrefix(value, commandPrefix) : value;
  return `${label}: ${formatted}`;
};

const buildUsageHint = (help, type, commandPrefix = DEFAULT_PREFIX) => {
  if (!help) {
    return null;
  }
  const lines = [
    formatUsageLine(help, type, 'usage', 'Usage', commandPrefix),
    formatUsageLine(help, type, 'examples', 'Exemple', commandPrefix)
  ].filter(Boolean);
  return lines.length > 0 ? lines.join('\n') : null;
};

/** Embed d'erreur court (sans usage / exemple). */
const replyCommandError = (configService, baseMessage, commandPrefix = DEFAULT_PREFIX) => ({
  embeds: [buildCommandErrorEmbed(configService, applyCommandPrefix(baseMessage, commandPrefix))]
});

/**
 * Réponse avec aide détaillée uniquement si includeHint est true (ex. infosanction).
 */
const buildUsageResponse = (baseMessage, help, type, commandPrefix = DEFAULT_PREFIX, includeHint = false) => {
  const message = type === 'prefix' ? applyCommandPrefix(baseMessage, commandPrefix) : baseMessage;
  if (!includeHint || !help) {
    return message;
  }
  const hint = buildUsageHint(help, type, commandPrefix);
  if (!hint) {
    return message;
  }
  return `${message}\n${hint}`;
};

module.exports = {
  cloneHelpData,
  applyCommandPrefix,
  buildUsageHint,
  buildUsageResponse,
  replyCommandError
};
