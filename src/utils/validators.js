const { SnowflakeUtil } = require('discord.js');

const validateSnowflake = (value) => {
  if (!value || typeof value !== 'string') {
    return false;
  }
  return SnowflakeUtil.deconstruct(value).timestamp > 0;
};

const validateDuration = (value) => {
  if (!value || typeof value !== 'string') {
    return false;
  }
  const durationRegex = /^(\d+)(s|m|h|d)$/i;
  return durationRegex.test(value);
};

const parseDuration = (value) => {
  if (!value || typeof value !== 'string') {
    return null;
  }
  const match = value.match(/^(\d+)(s|m|h|d)$/i);
  if (!match) {
    return null;
  }
  const amount = parseInt(match[1], 10);
  const unit = match[2].toLowerCase();
  const multipliers = { s: 1000, m: 60000, h: 3600000, d: 86400000 };
  return amount * (multipliers[unit] || 1000);
};

const validateUserId = (value) => {
  if (!value || typeof value !== 'string') {
    return false;
  }
  if (value.startsWith('<@') && value.endsWith('>')) {
    const id = value.replace(/[<@!>]/g, '');
    return validateSnowflake(id);
  }
  return validateSnowflake(value);
};

module.exports = {
  validateSnowflake,
  validateDuration,
  parseDuration,
  validateUserId
};
