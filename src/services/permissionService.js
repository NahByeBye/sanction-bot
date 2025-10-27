const { PermissionFlagsBits } = require('discord.js');

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
      dailyLimit: null
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
    if (this.isOwner(userId)) {
      return true;
    }
    if (member.permissions.has(PermissionFlagsBits.Administrator)) {
      return true;
    }
    const actionConfig = this.getActionConfig(action);
    if (!actionConfig || !Array.isArray(actionConfig.roleIds) || actionConfig.roleIds.length === 0) {
      return false;
    }
    return actionConfig.roleIds.some((roleId) => member.roles.cache.has(roleId));
  }
}

module.exports = { PermissionService };
