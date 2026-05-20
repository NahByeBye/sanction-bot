const logger = {
  log: (level, message, data = {}) => {
    const timestamp = new Date().toISOString();
    const logEntry = {
      timestamp,
      level,
      message,
      ...data
    };

    if (level === 'error') {
      console.error(JSON.stringify(logEntry));
    } else if (level === 'warn') {
      console.warn(JSON.stringify(logEntry));
    } else {
      console.log(JSON.stringify(logEntry));
    }
  },

  info: (message, data) => logger.log('info', message, data),
  warn: (message, data) => logger.log('warn', message, data),
  error: (message, data) => logger.log('error', message, data)
};

module.exports = logger;
