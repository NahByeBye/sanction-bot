const { initializeBot } = require('./botInit');

const { client, config } = initializeBot();

if (!config.token || config.token.startsWith('REPLACE')) {
  console.warn('token not configured');
} else {
  client.login(config.token).catch((error) => {
    console.error('login error:', error);
  });
}
