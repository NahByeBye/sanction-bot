const fs = require('fs').promises;
const fsSync = require('fs');
const path = require('path');
const zlib = require('zlib');

class BackupService {
  constructor(config) {
    this.config = config;
  }
}

const { Collection } = require('discord.js');
const { SanctionTypes } = require('../utils/actionKeys');
const { buildSanctionDmContent, buildUnmuteDmContent, sendSanctionDm } = require('../utils/sanctionNotify');
const {
  sortSanctionsAsc,
  buildMemberSanctionIndexMap,
  resolveSanctionByMemberIndex
} = require('../utils/memberSanctionIndex');
const { createAlreadyMutedError, createAlreadyBannedError, createAlreadyBlacklistedError } = require('../utils/sanctionSuccessEmbeds');
const { MAX_HISTORY_LIMIT, BLACKLIST_CACHE_KEY_SEPARATOR } = require('../constants');

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
      const key = `${row.guild_id}${BLACKLIST_CACHE_KEY_SEPARATOR}${row.target_id}`;
      this.blacklistCache.set(key, true);
    }
    return rows.length;
  }

  isUserBlacklisted(guildId, userId) {
    const key = `${guildId}${BLACKLIST_CACHE_KEY_SEPARATOR}${userId}`;
    return this.blacklistCache.has(key);
  }

  addBlacklistCache(guildId, userId) {
    const key = `${guildId}${BLACKLIST_CACHE_KEY_SEPARATOR}${userId}`;
    this.blacklistCache.set(key, true);
  }

  removeBlacklistCache(guildId, userId) {
    const key = `${guildId}${BLACKLIST_CACHE_KEY_SEPARATOR}${userId}`;
    this.blacklistCache.delete(key);
  }

  async notifySanctionDm({ targetUser, guild, sanctionType, reason, durationMs, muteMethod = null }) {
    const content = buildSanctionDmContent({
      guildName: guild.name,
      sanctionType,
      reason,
      durationMs,
      muteMethod
    });
    await sendSanctionDm(targetUser, content);
  }

  async notifyUnmuteDm({ targetUser, guild }) {
    await sendSanctionDm(targetUser, buildUnmuteDmContent(guild.name));
  }

  async checkRoleHierarchy(executorMember, targetMember) {
    if (!executorMember || !targetMember) {
      return true;
    }

    const executorId = executorMember.id;
    const targetId = targetMember.id;
    const mainOwnerId = this.configService.baseConfig.ownerId;

    if (executorId === mainOwnerId) {
      return true;
    }

    const executorIsBotOwner = this.db.isOwner(executorId);
    const targetIsBotOwner = this.db.isOwner(targetId);

    if (executorIsBotOwner && targetIsBotOwner) {
      throw new Error('Vous ne pouvez pas sanctionner un autre Owner Bot.');
    }

    const executorHighestRole = executorMember.roles.highest;
    const targetHighestRole = targetMember.roles.highest;

    if (targetHighestRole.position >= executorHighestRole.position) {
      throw new Error('Vous ne pouvez pas sanctionner une personne avec un rôle égal ou supérieur au vôtre.');
    }

    return true;
  }

  async banMemberFromGuild(guild, targetUser, reason) {
    const targetId = targetUser.id;
    const member = await guild.members.fetch(targetId).catch(() => null);
    if (member) {
      if (!member.bannable) {
        throw new Error('Impossible de bannir cet utilisateur.');
      }
      await member.ban({ reason });
    } else {
      await guild.members.ban(targetId, { reason });
    }
  }

  assertNotBlacklisted(guildId, targetId) {
    const blacklisted = this.db.findActiveSanction(guildId, targetId, [
      SanctionTypes.BLACKLIST,
      SanctionTypes.TEMPBLACKLIST
    ]);
    if (blacklisted) {
      throw new Error(
        'Cette personne est blacklistée du serveur. Seule la commande /unblacklist peut lever cette sanction.'
      );
    }
  }

  async applyBan({ guild, targetUser, executorUser, executorMember, reason, durationMs }) {
    const type = durationMs && durationMs > 0 ? SanctionTypes.TEMPBAN : SanctionTypes.BAN;
    const targetId = targetUser.id;
    const executorId = executorUser.id;

    if (this.db.isUserProtected(targetId)) {
      throw new Error('Ptdr, t\'as essayé de ban un membre protégé ?');
    }

    const targetMember = await guild.members.fetch(targetId).catch(() => null);
    if (targetMember && executorMember) {
      await this.checkRoleHierarchy(executorMember, targetMember);
    }

    this.assertNotBlacklisted(guild.id, targetId);

    const existing = this.db.findActiveSanction(guild.id, targetId, [SanctionTypes.BAN, SanctionTypes.TEMPBAN]);
    if (existing) {
      throw createAlreadyBannedError();
    }

    await this.notifySanctionDm({ targetUser, guild, sanctionType: type, reason, durationMs });

    await this.banMemberFromGuild(guild, targetUser, reason);

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

  async applyKick({ guild, targetUser, executorUser, executorMember, reason }) {
    const member = await guild.members.fetch(targetUser.id).catch(() => null);
    if (!member) {
      throw new Error('Utilisateur introuvable dans le serveur.');
    }
    if (executorMember) {
      await this.checkRoleHierarchy(executorMember, member);
    }
    if (!member.kickable) {
      throw new Error('Impossible de kick cet utilisateur.');
    }

    await this.notifySanctionDm({
      targetUser,
      guild,
      sanctionType: SanctionTypes.KICK,
      reason,
      durationMs: null
    });

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

  async unbanUser({ guild, targetUser, executorUser, reason }) {
    const targetId = targetUser.id;
    const banSanction = this.db.findActiveSanction(guild.id, targetId, [SanctionTypes.BAN, SanctionTypes.TEMPBAN]);
    const remainedBlacklisted = this.isUserBlacklisted(guild.id, targetId);

    if (!banSanction && !remainedBlacklisted) {
      throw new Error('Aucun ban pour cet utilisateur.');
    }

    const isBanned = await guild.bans.fetch(targetId).then(() => true).catch(() => false);
    if (isBanned) {
      await guild.bans.remove(targetId, reason);
    }

    if (banSanction) {
      this.db.revokeSanction(banSanction.id, {
        executorId: executorUser.id,
        executorTag: getUserTag(executorUser),
        reason
      });
    }

    return { banSanction, remainedBlacklisted };
  }

  async revokeBan({ guild, sanction, executorUser, reason }) {
    const targetId = sanction.target_id;
    await guild.bans.remove(targetId, reason).catch(() => null);

    this.db.revokeSanction(sanction.id, {
  executorId: executorUser.id,
  executorTag: getUserTag(executorUser),
      reason
    });
  }

  async applyWarn({ guild, targetUser, executorUser, executorMember, reason }) {
    const targetMember = await guild.members.fetch(targetUser.id).catch(() => null);
    if (targetMember && executorMember) {
      await this.checkRoleHierarchy(executorMember, targetMember);
    }

    const record = this.db.recordSanction({
      guildId: guild.id,
      type: SanctionTypes.WARN,
      targetId: targetUser.id,
      targetTag: getUserTag(targetUser),
      executorId: executorUser.id,
      executorTag: getUserTag(executorUser),
      reason,
      durationMs: null
    });

    await this.notifySanctionDm({
      targetUser,
      guild,
      sanctionType: SanctionTypes.WARN,
      reason,
      durationMs: null
    });

    return record;
  }

  async ensureMuteRole(guild) {

    let storedRoleId = this.db.getGuildRole(guild.id, 'MUTE');

    if (storedRoleId) {

      try {
        await guild.roles.fetch(storedRoleId);
        return guild.roles.cache.get(storedRoleId);
      } catch (error) {

        this.db.deleteGuildRole(guild.id, 'MUTE');
        storedRoleId = null;
      }
    }

    if (!storedRoleId) {

      try {
        const muteRole = await guild.roles.create({
          name: 'Mute',
          reason: 'Rôle créé automatiquement pour les sanctions de mute',
          mentionable: false
        });

        this.db.setGuildRole(guild.id, 'MUTE', muteRole.id);
        return muteRole;
      } catch (error) {
        throw new Error(`Impossible de créer le rôle Mute: ${error.message}`);
      }
    }
  }

  async assertNotMuted(guild, targetId) {
    const existing = this.db.findActiveSanction(guild.id, targetId, [SanctionTypes.MUTE, SanctionTypes.TEMPMUTE]);
    if (existing) {
      throw createAlreadyMutedError();
    }

    const member = await guild.members.fetch(targetId).catch(() => null);
    if (!member) {
      return;
    }

    if (
      member.communicationDisabledUntilTimestamp
      && member.communicationDisabledUntilTimestamp > Date.now()
    ) {
      throw createAlreadyMutedError();
    }

    const muteRoleId = this.db.getGuildRole(guild.id, 'MUTE');
    if (muteRoleId && member.roles.cache.has(muteRoleId)) {
      throw createAlreadyMutedError();
    }
  }

  async applyMute({ guild, targetUser, executorUser, executorMember, reason, durationMs, muteType = 'timeout' }) {
    const targetId = targetUser.id;
    await this.assertNotMuted(guild, targetId);
    const member = await guild.members.fetch(targetId).catch(() => null);
    if (!member) {
      throw new Error('Utilisateur introuvable dans le serveur.');
    }
    if (executorMember) {
      await this.checkRoleHierarchy(executorMember, member);
    }
    if (!member.manageable) {
      throw new Error('Impossible de mute cet utilisateur.');
    }

    let type, useTimeoutMethod = false;

    if (muteType === 'timeout' || muteType === 'tempmute_timeout') {

      if (!durationMs || durationMs <= 0) {
        throw new Error('Une durée est requise pour le timeout.');
      }
      type = SanctionTypes.TEMPMUTE;
      useTimeoutMethod = true;
    } else if (muteType === 'role' || muteType === 'tempmute_role') {

      if (!durationMs || durationMs <= 0) {
        throw new Error('Une durée est requise pour le mute.');
      }
      type = SanctionTypes.TEMPMUTE;
    } else {

      const isTempMute = durationMs && durationMs > 0;
      type = isTempMute ? SanctionTypes.TEMPMUTE : SanctionTypes.MUTE;
      useTimeoutMethod = isTempMute;
    }

    if (useTimeoutMethod) {

      await member.timeout(durationMs, reason);
    } else {

      const muteRole = await this.ensureMuteRole(guild);
      await member.roles.add(muteRole, reason);
    }

    try {
      if (member.voice?.channel) {
        await member.voice.disconnect(reason || 'Mute appliqué');
      }
    } catch (error) {
      console.warn(`[SANCTION] Impossible de déconnecter ${targetId} du vocal:`, error.message);
    }

    const record = this.db.recordSanction({
      guildId: guild.id,
      type,
      targetId,
      targetTag: getUserTag(member.user),
      executorId: executorUser.id,
      executorTag: getUserTag(executorUser),
      reason,
      durationMs
    });

    await this.notifySanctionDm({
      targetUser,
      guild,
      sanctionType: type,
      reason,
      durationMs,
      muteMethod: useTimeoutMethod ? 'timeout' : 'role'
    });

    return record;
  }

  async revokeMute({ guild, sanction, executorUser, reason }) {
    const targetId = sanction.target_id;
    const member = await guild.members.fetch(targetId).catch(() => null);
    if (member) {
      await member.timeout(null, reason).catch(() => null);
      const muteRole = await this.ensureMuteRole(guild).catch(() => null);
      if (muteRole) {
        await member.roles.remove(muteRole, reason).catch(() => null);
      }
    }

    this.db.revokeSanction(sanction.id, {
      executorId: executorUser.id,
      executorTag: getUserTag(executorUser),
      reason
    });

    const targetUser = member?.user ?? await this.client.users.fetch(targetId).catch(() => null);
    if (targetUser) {
      await this.notifyUnmuteDm({ targetUser, guild });
    }
  }

  listActiveBlacklists(guildId) {
    return this.db.listGuildActiveBlacklists(guildId);
  }

  wasBlacklistedByOwner(sanction) {
    const events = this.db.getSanctionEvents(sanction.id);
    const applied = events.find((event) => event.action === 'APPLIED');
    if (applied?.metadata) {
      try {
        const meta = JSON.parse(applied.metadata);
        if (meta.byOwner === true) {
          return true;
        }
      } catch {
      }
    }
    return this.db.isOwner(sanction.executor_id);
  }

  assertCanRevokeBlacklist(sanction, executorUser) {
    if (!this.wasBlacklistedByOwner(sanction)) {
      return;
    }
    if (this.db.isOwner(executorUser.id)) {
      return;
    }
    throw new Error('Cet utilisateur a été blacklisté par un Owner.');
  }

  async applyBlacklist({ guild, targetUser, executorUser, executorMember, reason, durationMs }) {
    const type = durationMs && durationMs > 0 ? SanctionTypes.TEMPBLACKLIST : SanctionTypes.BLACKLIST;
    const targetId = targetUser.id;

    if (this.db.isUserProtected(targetId)) {
      throw new Error('Ptdr, t\'as essayé de bl un membre protégé ?');
    }

    const targetMember = await guild.members.fetch(targetId).catch(() => null);
    if (targetMember && executorMember) {
      await this.checkRoleHierarchy(executorMember, targetMember);
    }

    const existing = this.db.findActiveSanction(guild.id, targetId, [
      SanctionTypes.BLACKLIST,
      SanctionTypes.TEMPBLACKLIST
    ]);
    if (existing) {
      throw createAlreadyBlacklistedError();
    }

    const existingBan = this.db.findActiveSanction(guild.id, targetId, [SanctionTypes.BAN, SanctionTypes.TEMPBAN]);
    if (existingBan) {
      this.db.revokeSanction(existingBan.id, {
        executorId: executorUser.id,
        executorTag: getUserTag(executorUser),
        reason: 'Remplacée par une blacklist'
      });
    }

    await this.notifySanctionDm({ targetUser, guild, sanctionType: type, reason, durationMs });

    const banReason = `[BLACKLIST] ${reason}`;
    await this.banMemberFromGuild(guild, targetUser, banReason);

    const isOwner = this.db.isOwner(executorUser.id) || executorUser.id === this.configService.baseConfig.ownerId;
    const record = this.db.recordSanction({
      guildId: guild.id,
      type,
      targetId,
      targetTag: getUserTag(targetUser),
      executorId: executorUser.id,
      executorTag: getUserTag(executorUser),
      reason,
      durationMs,
      metadata: isOwner ? { byOwner: true } : null
    });
    this.addBlacklistCache(guild.id, targetId);

    return record;
  }

  async revokeBlacklist({ guild, sanction, executorUser, reason, skipOwnerCheck = false }) {
    if (!skipOwnerCheck) {
      this.assertCanRevokeBlacklist(sanction, executorUser);
    }
    const targetId = sanction.target_id;
    const unbanReason = `[UNBLACKLIST] ${reason}`;
    await guild.bans.remove(targetId, unbanReason).catch(() => null);

    this.db.revokeSanction(sanction.id, {
      executorId: executorUser.id,
      executorTag: getUserTag(executorUser),
      reason
    });

    this.removeBlacklistCache(guild.id, targetId);
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
        await this.revokeBlacklist({ guild, sanction, executorUser, reason, skipOwnerCheck: true });
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

  async resolveGuild(guildId) {
    let guild = this.client.guilds.cache.get(guildId);
    if (guild) {
      return guild;
    }
    try {
      return await this.client.guilds.fetch(guildId);
    } catch {
      return null;
    }
  }

  async processExpiredSanctions() {
    const now = Date.now();
    const dueSanctions = this.db.getDueSanctions(now);
    const stats = { due: dueSanctions.length, processed: 0, failed: 0, skipped: 0 };

    for (const sanction of dueSanctions) {
      const guild = await this.resolveGuild(sanction.guild_id);
      if (!guild) {
        stats.skipped++;
        console.warn(`sanction ignored ${sanction.id}`);
        continue;
      }

      try {
        await this.handleSanctionExpiration({ sanction, guild });
        stats.processed++;
        console.log(`unblacklist ${sanction.target_id}`);
      } catch (error) {
        stats.failed++;
        console.error(`unblacklist error ${sanction.id}:`, error.message);
      }
    }

    return stats;
  }

  listSanctions(guildId, targetId, limit = 20, offset = 0) {
    return this.db.listSanctions(guildId, targetId, limit, offset);
  }

  listSanctionHistory(guildId, targetId, limit = 100, offset = 0) {
    return this.db.listSanctionHistory(guildId, targetId, limit, offset);
  }

  getMemberSanctionIndexMap(guildId, targetId) {
    const history = this.listSanctionHistory(guildId, targetId, MAX_HISTORY_LIMIT, 0);
    return buildMemberSanctionIndexMap(sortSanctionsAsc(history));
  }

  getSanctionByMemberIndex(guildId, targetId, memberIndex) {
    const history = this.listSanctionHistory(guildId, targetId, MAX_HISTORY_LIMIT, 0);
    return resolveSanctionByMemberIndex(sortSanctionsAsc(history), memberIndex);
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

  async clearSanctions({ guild, targetUser, executorUser, reason, typeFilter = null, includeRevoked = false }) {
    const guildId = guild.id;
    const targetId = targetUser.id;
    const revokeOrder = {
      [SanctionTypes.BLACKLIST]: 0,
      [SanctionTypes.TEMPBLACKLIST]: 0,
      [SanctionTypes.BAN]: 1,
      [SanctionTypes.TEMPBAN]: 1,
      [SanctionTypes.TEMPMUTE]: 2,
      [SanctionTypes.MUTE]: 2
    };

    let sanctions;
    if (includeRevoked) {
      sanctions = this.db.listSanctionHistory(guildId, targetId, 1000, 0);
      if (typeFilter) {
        sanctions = sanctions.filter(s => s.type.toLowerCase() === typeFilter.toLowerCase());
      }
    } else {
      sanctions = this.db.listActiveSanctions(guildId, targetId, typeFilter);
    }

    sanctions = sanctions.sort((a, b) => (revokeOrder[a.type] ?? 9) - (revokeOrder[b.type] ?? 9));

    const clearedIds = [];
    for (const sanction of sanctions) {
      try {
        if (sanction.active === 1) {
          switch (sanction.type) {
            case SanctionTypes.BAN:
            case SanctionTypes.TEMPBAN:
              await this.revokeBan({ guild, sanction, executorUser, reason });
              break;
            case SanctionTypes.MUTE:
            case SanctionTypes.TEMPMUTE:
              await this.revokeMute({ guild, sanction, executorUser, reason });
              break;
            case SanctionTypes.BLACKLIST:
            case SanctionTypes.TEMPBLACKLIST:
              await this.revokeBlacklist({ guild, sanction, executorUser, reason });
              break;
            default:
              this.db.revokeSanction(sanction.id, {
                executorId: executorUser.id,
                executorTag: getUserTag(executorUser),
                reason
              });
          }
        } else {
          this.db.deleteSanctionById(sanction.id);
          this.db.deleteSanctionEvents(sanction.id);
        }
        clearedIds.push(sanction.id);
      } catch (error) {
        console.error(`clear error ${sanction.id}:`, error.message);
      }
    }

    return clearedIds;
  }
}

module.exports = { SanctionService };
