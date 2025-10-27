const ms = require('ms');

const formatDuration = (value) => {
  if (!value || value <= 0) {
    return 'permanent';
  }
  return ms(value, { long: true });
};

const parseDuration = (value) => {
  if (!value) {
    return { milliseconds: null, human: null };
  }
  try {
    const milliseconds = ms(value);
    if (!milliseconds || Number.isNaN(milliseconds)) {
      return { milliseconds: null, human: null };
    }
    return { milliseconds, human: formatDuration(milliseconds) };
  } catch (error) {
    return { milliseconds: null, human: null };
  }
};

module.exports = {
  formatDuration,
  parseDuration
};
