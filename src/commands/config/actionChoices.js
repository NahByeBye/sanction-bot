const { ActionKeys } = require('../../utils/actionKeys');

const actionChoices = [
  { name: 'Ban', value: ActionKeys.BAN },
  { name: 'Kick', value: ActionKeys.KICK },
  { name: 'Warn', value: ActionKeys.WARN },
  { name: 'Mute', value: ActionKeys.MUTE },
  { name: 'TempMute', value: ActionKeys.TEMPMUTE },
  { name: 'Unban', value: ActionKeys.UNBAN },
  { name: 'Unmute', value: ActionKeys.UNMUTE },
  { name: 'Liste sanctions', value: ActionKeys.LIST }
];

module.exports = {
  actionChoices
};
