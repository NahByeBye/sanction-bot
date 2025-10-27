module.exports = [
  ...require('./ban'),
  ...require('./kick'),
  ...require('./mute'),
  require('./warn/warn'),
  ...require('./blacklist'),
  require('./history/listSanctions'),
  ...require('./owner'),
  ...require('./config')
];
