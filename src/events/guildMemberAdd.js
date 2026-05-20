const handleGuildMemberAdd = async (member, sanctionService, db) => {
  if (!member || !member.guild) {
    return;
  }

  const guildId = member.guild.id;
  const userId = member.id;

  db.logConnection(userId, guildId, null, null, null);

  const isBlacklisted = sanctionService.isUserBlacklisted(guildId, userId);
  if (isBlacklisted) {
    try {
      await member.ban({
        reason: 'blacklist'
      });
      console.log(`blacklist ${userId}`);
    } catch (error) {
      console.error(`blacklist error ${userId}:`, error.message);
    }
    return;
  }

  const altMatch = db.detectAltAccount(guildId, userId);
  if (altMatch) {
    try {
      await member.ban({
        reason: 'alt account'
      });
      console.log(`alt account ${userId}`);
    } catch (error) {
      console.error(`alt account error ${userId}:`, error.message);
    }
  }
};

module.exports = { handleGuildMemberAdd };
