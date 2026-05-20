const ActionKeys = {
  BAN: 'sanction:ban',
  KICK: 'sanction:kick',
  TEMPBAN: 'sanction:tempban',
  UNBAN: 'sanction:unban',
  WARN: 'sanction:warn',
  MUTE: 'sanction:mute',
  TEMPMUTE: 'sanction:tempmute',
  UNMUTE: 'sanction:unmute',
  BLACKLIST: 'sanction:blacklist',
  TEMPBLACKLIST: 'sanction:tempblacklist',
  UNBLACKLIST: 'sanction:unblacklist',
  CLEAR_SANCTIONS: 'sanction:clear',
  LIST: 'sanction:list',
  BANINFO: 'sanction:baninfo',
  BLINFO: 'sanction:blinfo',
  CONFIGURE: 'admin:configure',
  OWNER_MANAGE: 'admin:owner'
};

const SanctionTypes = {
  BAN: 'BAN',
  TEMPBAN: 'TEMPBAN',
  UNBAN: 'UNBAN',
  KICK: 'KICK',
  WARN: 'WARN',
  MUTE: 'MUTE',
  TEMPMUTE: 'TEMPMUTE',
  UNMUTE: 'UNMUTE',
  BLACKLIST: 'BLACKLIST',
  TEMPBLACKLIST: 'TEMPBLACKLIST',
  UNBLACKLIST: 'UNBLACKLIST'
};

module.exports = {
  ActionKeys,
  SanctionTypes
};