const ms = require('ms');

const formatDuration = (value) => {
  if (!value || value <= 0) {
    return 'permanent';
  }
  return ms(value, { long: true });
};

const discordTimestamp = (ts, style = 'f') => {
  if (!ts) return 'N/A';
  return `<t:${Math.floor(ts / 1000)}:${style}>`;
};

const discordDateShort = (ts) => {
  if (!ts) return 'N/A';
  return discordTimestamp(ts, 'd');
};

const _pad2 = (n) => (n < 10 ? `0${n}` : `${n}`);

const formatDateWithRelative = (ts) => {
  if (!ts) return 'N/A';
  const date = new Date(ts);

  const options = {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  };
  const full = date.toLocaleString('fr-FR', options);

  const now = Date.now();
  const delta = now - date.getTime();
  const abs = Math.abs(delta);

  const minute = 60 * 1000;
  const hour = 60 * minute;
  const day = 24 * hour;
  const month = 30 * day;

  let rel = '';
  if (abs >= month) {
    const months = Math.floor(abs / month);
    rel = `il y a ${months} mois`;
  } else if (abs >= day) {
    const days = Math.floor(abs / day);
    rel = `il y a ${days}j`;
  } else if (abs >= hour) {
    const hours = Math.floor(abs / hour);
    rel = `il y a ${hours}h`;
  } else if (abs >= minute) {
    const minutes = Math.floor(abs / minute);
    rel = `il y a ${minutes}m`;
  } else {
    rel = `à l'instant`;
  }

  return `${full} (${rel})`;
};

const DURATION_UNIT_MS = {
  s: 1000,
  m: 60 * 1000,
  h: 60 * 60 * 1000,
  j: 24 * 60 * 60 * 1000,
  d: 24 * 60 * 60 * 1000
};

const parseDuration = (value) => {
  if (!value) {
    return { milliseconds: null, human: null };
  }

  const raw = String(value).trim().toLowerCase();
  if (!raw) {
    return { milliseconds: null, human: null };
  }

  const compact = raw.match(/^(\d+)\s*([smhjd])$/i);
  if (compact) {
    const amount = parseInt(compact[1], 10);
    const unit = compact[2].toLowerCase();
    if (!amount || amount <= 0 || !DURATION_UNIT_MS[unit]) {
      return { milliseconds: null, human: null };
    }
    const milliseconds = amount * DURATION_UNIT_MS[unit];
    return { milliseconds, human: formatDuration(milliseconds) };
  }

  try {
    const normalized = raw.replace(/(\d+)\s*j\b/gi, '$1d');
    const milliseconds = ms(normalized);
    if (!milliseconds || Number.isNaN(milliseconds) || milliseconds <= 0) {
      return { milliseconds: null, human: null };
    }
    return { milliseconds, human: formatDuration(milliseconds) };
  } catch (error) {
    return { milliseconds: null, human: null };
  }
};

const formatDurationFrench = (milliseconds) => {
  if (!milliseconds || milliseconds <= 0) {
    return null;
  }
  const totalSeconds = Math.floor(milliseconds / 1000);
  if (totalSeconds < 60) {
    return `${totalSeconds} seconde${totalSeconds > 1 ? 's' : ''}`;
  }
  const totalMinutes = Math.floor(totalSeconds / 60);
  if (totalMinutes < 60) {
    return `${totalMinutes} minute${totalMinutes > 1 ? 's' : ''}`;
  }
  const totalHours = Math.floor(totalMinutes / 60);
  if (totalHours < 24) {
    return `${totalHours} heure${totalHours > 1 ? 's' : ''}`;
  }
  const totalDays = Math.floor(totalHours / 24);
  return `${totalDays} jour${totalDays > 1 ? 's' : ''}`;
};

module.exports = {
  formatDuration,
  formatDurationFrench,
  parseDuration,
  formatDateWithRelative,
  discordTimestamp,
  discordDateShort
};
