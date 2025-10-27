const { Collection } = require('discord.js');
const { SanctionTypes } = require('../utils/actionKeys');

const getUserTag = (user) => {
  if (!user) {
    return 'unknown#0000';
  }
  if (user.tag) {
    return user.tag;
  }
  const discriminator = typeof user.discriminator === 'string' ? user.discriminator : '0000';
  return `${user.username}#${discriminator}`;
};

class SanctionService {
  constructor({ db, configService, client }) {
    this.db = db;
    this.configService = configService;
    this.client = client;
    this.blacklistCache = new Collection();
    this.loadBlacklistCache();
  }

  loadBlacklistCache() {
    this.blacklistCache.clear();
    const rows = this.db.db
      .prepare('SELECT guild_id, target_id FROM sanctions WHERE active = 1 AND type IN (?, ?)')
      .all(SanctionTypes.BLACKLIST, SanctionTypes.TEMPBLACKLIST);
    for (const row of rows) {
      const key = `${row.guild_id}:${row.target_id}`;
      this.blacklistCache.set(key, true);
    }
    return rows.length;
  }

  isUserBlacklisted(guildId, userId) {
    const key = `${guildId}:${userId}`;
    return this.blacklistCache.has(key);
  }

  addBlacklistCache(guildId, userId) {
    const key = `${guildId}:${userId}`;
    this.blacklistCache.set(key, true);
  }

  removeBlacklistCache(guildId, userId) {
    const key = `${guildId}:${userId}`;
    this.blacklistCache.delete(key);
  }

  async applyBan({ guild, targetUser, executorUser, reason, durationMs }) {
    const type = durationMs && durationMs > 0 ? SanctionTypes.TEMPBAN : SanctionTypes.BAN;
    const targetId = targetUser.id;
    const executorId = executorUser.id;

    const existing = this.db.findActiveSanction(guild.id, targetId, [SanctionTypes.BAN, SanctionTypes.TEMPBAN]);
    if (existing) {
      throw new Error('Une sanction de ban est déjà active pour cet utilisateur.');
    }

    const member = await guild.members.fetch(targetId).catch(() => null);
    if (member) {
      if (!member.bannable) {
        throw new Error('Impossible de bannir cet utilisateur.');
      }
      await member.ban({ reason });
    } else {
      await guild.members.ban(targetId, { reason });
    }

    const record = this.db.recordSanction({
      guildId: guild.id,
      type,
      targetId,
  targetTag: getUserTag(targetUser),
  executorId,
  executorTag: getUserTag(executorUser),
      reason,
      durationMs
    });

    return record;
  }

  async applyKick({ guild, targetUser, executorUser, reason }) {
    const member = await guild.members.fetch(targetUser.id).catch(() => null);
    if (!member) {
      throw new Error('Utilisateur introuvable dans le serveur.');
    }
    if (!member.kickable) {
      throw new Error('Impossible de kick cet utilisateur.');
    }

    await member.kick(reason);

    return this.db.recordSanction({
      guildId: guild.id,
      type: SanctionTypes.KICK,
      targetId: targetUser.id,
      targetTag: getUserTag(targetUser),
      executorId: executorUser.id,
      executorTag: getUserTag(executorUser),
      reason,
      durationMs: null
    });
  }

  async revokeBan({ guild, sanction, executorUser, reason }) {
    const targetId = sanction.target_id;
    await guild.bans.remove(targetId, reason).catch(() => null);

    this.db.revokeSanction(sanction.id, {
  executorId: executorUser.id,
  executorTag: getUserTag(executorUser),
      reason
    });

    this.db.recordSanction({
      guildId: guild.id,
      type: SanctionTypes.UNBAN,
      targetId,
      targetTag: sanction.target_tag,
      executorId: executorUser.id,
      executorTag: executorUser.tag,
      reason,
      durationMs: null,
      metadata: { revokedSanctionId: sanction.id }
    });
  }

  async applyWarn({ guild, targetUser, executorUser, reason }) {
    return this.db.recordSanction({
      guildId: guild.id,
      type: SanctionTypes.WARN,
      targetId: targetUser.id,
  targetTag: getUserTag(targetUser),
  executorId: executorUser.id,
  executorTag: getUserTag(executorUser),
      reason,
      durationMs: null
    });
  }

  async applyMute({ guild, targetUser, executorUser, reason, durationMs }) {
    const type = durationMs && durationMs > 0 ? SanctionTypes.TEMPMUTE : SanctionTypes.MUTE;
    const targetId = targetUser.id;
    const existing = this.db.findActiveSanction(guild.id, targetId, [SanctionTypes.MUTE, SanctionTypes.TEMPMUTE]);
    if (existing) {
      throw new Error('Une sanction de mute est déjà active pour cet utilisateur.');
    }
    const member = await guild.members.fetch(targetId).catch(() => null);
    if (!member) {
      throw new Error('Utilisateur introuvable dans le serveur.');
    }
    if (!member.moderatable) {
      throw new Error('Impossible de mute cet utilisateur.');
    }

    // Discord impose un timeout maximum de 28 jours.
    if (!durationMs || durationMs <= 0) {
      const twentyEightDaysMs = 28 * 24 * 60 * 60 * 1000;
      durationMs = twentyEightDaysMs;
    }

    await member.timeout(durationMs, reason);

    return this.db.recordSanction({
      guildId: guild.id,
      type,
      targetId,
  targetTag: getUserTag(member.user),
  executorId: executorUser.id,
  executorTag: getUserTag(executorUser),
      reason,
      durationMs
    });
  }

  async revokeMute({ guild, sanction, executorUser, reason }) {
    const targetId = sanction.target_id;
    const member = await guild.members.fetch(targetId).catch(() => null);
    if (member) {
      await member.timeout(null, reason).catch(() => null);
    }

    this.db.revokeSanction(sanction.id, {
  executorId: executorUser.id,
  executorTag: getUserTag(executorUser),
      reason
    });

    this.db.recordSanction({
      guildId: guild.id,
      type: SanctionTypes.UNMUTE,
      targetId,
  targetTag: sanction.target_tag,
  executorId: executorUser.id,
  executorTag: getUserTag(executorUser),
      reason,
      durationMs: null,
      metadata: { revokedSanctionId: sanction.id }
    });
  }

  async applyBlacklist({ guild, targetUser, executorUser, reason, durationMs }) {
    const type = durationMs && durationMs > 0 ? SanctionTypes.TEMPBLACKLIST : SanctionTypes.BLACKLIST;
    const existing = this.db.findActiveSanction(guild.id, targetUser.id, [
      SanctionTypes.BLACKLIST,
      SanctionTypes.TEMPBLACKLIST
    ]);
    if (existing) {
      throw new Error('Cette personne est déjà blacklistée.');
    }
    const record = this.db.recordSanction({
      guildId: guild.id,
      type,
      targetId: targetUser.id,
  targetTag: getUserTag(targetUser),
  executorId: executorUser.id,
  executorTag: getUserTag(executorUser),
      reason,
      durationMs
    });
    this.addBlacklistCache(guild.id, targetUser.id);
    return record;
  }

  async revokeBlacklist({ guild, sanction, executorUser, reason }) {
    this.db.revokeSanction(sanction.id, {
  executorId: executorUser.id,
  executorTag: getUserTag(executorUser),
      reason
    });

    this.removeBlacklistCache(guild.id, sanction.target_id);

    this.db.recordSanction({
      guildId: guild.id,
      type: SanctionTypes.UNBLACKLIST,
      targetId: sanction.target_id,
  targetTag: sanction.target_tag,
  executorId: executorUser.id,
  executorTag: getUserTag(executorUser),
      reason,
      durationMs: null,
      metadata: { revokedSanctionId: sanction.id }
    });
  }

  async handleSanctionExpiration({ sanction, guild }) {
    const executorUser = guild.members.me ? guild.members.me.user : this.client.user;
    const reason = 'Sanction expirée automatiquement.';
    switch (sanction.type) {
      case SanctionTypes.TEMPBAN:
        await this.revokeBan({ guild, sanction, executorUser, reason });
        break;
      case SanctionTypes.TEMPMUTE:
        await this.revokeMute({ guild, sanction, executorUser, reason });
        break;
      case SanctionTypes.TEMPBLACKLIST:
        await this.revokeBlacklist({ guild, sanction, executorUser, reason });
        break;
      default:
        this.db.revokeSanction(sanction.id, {
          executorId: executorUser.id,
          executorTag: executorUser.tag,
          reason
        });
        break;
    }
  }

  async processExpiredSanctions() {
    const now = Date.now();
    const dueSanctions = this.db.getDueSanctions(now);
    for (const sanction of dueSanctions) {
      const guild = this.client.guilds.cache.get(sanction.guild_id);
      if (!guild) {
        continue;
      }
      try {
        await this.handleSanctionExpiration({ sanction, guild });
      } catch (error) {
        console.error(`Erreur lors de la levée de la sanction ${sanction.id}:`, error);
      }
    }
  }

  listSanctions(guildId, targetId, limit = 20, offset = 0) {
    return this.db.listSanctions(guildId, targetId, limit, offset);
  }

  getSanctionById(id) {
    return this.db.getSanctionById(id);
  }

  getSanctionEvents(id) {
    return this.db.getSanctionEvents(id);
  }

  findActiveSanction(guildId, userId, types) {
    return this.db.findActiveSanction(guildId, userId, types);
  }
}

module.exports = { SanctionService };
