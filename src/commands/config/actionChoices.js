const { ActionKeys } = require('../../utils/actionKeys');

const actionChoices = [
  { name: 'Ban', value: ActionKeys.BAN },
  { name: 'Kick', value: ActionKeys.KICK },
  { name: 'TempBan', value: ActionKeys.TEMPBAN },
  { name: 'Warn', value: ActionKeys.WARN },
  { name: 'Mute', value: ActionKeys.MUTE },
  { name: 'TempMute', value: ActionKeys.TEMPMUTE },
  { name: 'Blacklist', value: ActionKeys.BLACKLIST },
  { name: 'TempBlacklist', value: ActionKeys.TEMPBLACKLIST },
  { name: 'Unban', value: ActionKeys.UNBAN },
  { name: 'Unmute', value: ActionKeys.UNMUTE },
  { name: 'Unblacklist', value: ActionKeys.UNBLACKLIST },
  { name: 'Liste', value: ActionKeys.LIST }
];

module.exports = {
  actionChoices
};
