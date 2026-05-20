const { PermissionFlagsBits } = require('discord.js');
const { DEFAULT_DAILY_LIMIT, DEFAULT_LIMIT_WINDOW_SECONDS } = require('../constants');

class PermissionService {
  constructor(db, configService) {
    this.db = db;
    this.configService = configService;
  }

  isOwner(userId) {
    return this.db.isOwner(userId);
  }

  addOwner(userId, addedBy, isPrimary = false) {
    this.db.addOwner(userId, addedBy, isPrimary);
  }

  removeOwner(userId) {
    this.db.removeOwner(userId);
  }

  listOwners() {
    return this.db.getOwners();
  }

  getActionConfig(action) {
    const config = this.db.getActionConfig(action);
    if (config) {
      return config;
    }
    const fallbackCooldown = this.configService.getDefaultCooldownSeconds() * 1000;
    return {
      action,
      roleIds: [],
      cooldownMs: fallbackCooldown,
      dailyLimit: null,
      limitWindowSeconds: DEFAULT_LIMIT_WINDOW_SECONDS
    };
  }

  setActionConfig(action, config) {
    this.db.setActionConfig(action, config);
  }

  async canExecute(member, action) {
    if (!member) {
      return false;
    }
    const userId = member.id;
    const guildId = member.guild.id;

    if (this.isOwner(userId)) {
      return true;
    }
    if (member.permissions.has(PermissionFlagsBits.Administrator)) {
      return true;
    }

    const punishedActions = ['sanction:ban', 'sanction:blacklist', 'sanction:unblacklist'];
    if (punishedActions.includes(action) && this.db.isUserPunished(userId)) {
      return { allowed: false, reason: 'punished' };
    }

    const isWhitelisted = this.db.isUserWhitelisted(guildId, userId);
    if (!isWhitelisted) {
      return false;
    }

    const actionConfig = this.getActionConfig(action);
    if (!actionConfig || !Array.isArray(actionConfig.roleIds) || actionConfig.roleIds.length === 0) {
      return true;
    }
    return actionConfig.roleIds.some((roleId) => member.roles.cache.has(roleId));
  }

  getWhitelistedUserLimits(guildId, member, actionKey = null) {
    if (!member) {
      return null;
    }

    const userId = member.id;
    if (this.isOwner(userId)) {
      return { dailyLimit: null, cooldownMs: 0 };
    }
    if (member.permissions.has(PermissionFlagsBits.Administrator)) {
      return { dailyLimit: null, cooldownMs: 0 };
    }

    const userRoles = member.roles.cache.map(role => role.id);
    const allLimits = this.db.getAllWhitelistRoleLimits(guildId);

    let highestDailyLimit = 0;
    let lowestCooldownMs = Infinity;
    let hasConfiguredRole = false;

    for (const roleId of userRoles) {
      let limit = null;
      if (actionKey) {
        limit = allLimits.find(l => l.roleId === roleId && l.actionKey === actionKey);
      }
      if (!limit) {
        limit = allLimits.find(l => l.roleId === roleId && l.actionKey === 'all');
      }
      
      if (limit) {
        hasConfiguredRole = true;
        if (limit.dailyLimit > highestDailyLimit) {
          highestDailyLimit = limit.dailyLimit;
        }
        if (limit.cooldownMs < lowestCooldownMs) {
          lowestCooldownMs = limit.cooldownMs;
        }
      }
    }

    if (!hasConfiguredRole) {
      return { dailyLimit: DEFAULT_DAILY_LIMIT, cooldownMs: 0 };
    }

    if (highestDailyLimit === 0 && lowestCooldownMs === Infinity) {
      return { dailyLimit: 0, cooldownMs: 0 };
    }

    return {
      dailyLimit: highestDailyLimit > 0 ? highestDailyLimit : null,
      cooldownMs: lowestCooldownMs === Infinity ? 0 : lowestCooldownMs
    };
  }
}

module.exports = { PermissionService };
