class ConfigService {
  constructor(db, baseConfig) {
    this.db = db;
    this.baseConfig = baseConfig;
  }

  get(key) {
    const override = this.db.getSetting(key, undefined);
    if (typeof override !== 'undefined' && override !== null) {
      return override;
    }
    return this.baseConfig[key];
  }

  set(key, value) {
    this.db.setSetting(key, value);
  }

  getBoolean(key) {
    const value = this.get(key);
    return Boolean(value);
  }

  getNumber(key) {
    const value = this.get(key);
    const parsed = Number(value);
    return Number.isNaN(parsed) ? null : parsed;
  }

  getColor() {
    return this.get('color') || '#5865F2';
  }

  getFooter() {
    return this.get('footer') || '';
  }

  getPrefix() {
    return this.get('prefix') || '&';
  }

  getCommandMode(commandKey) {
    if (!commandKey) {
      return 'prefix';
    }
    const value = this.get(`commandAvailability.${commandKey}`);
    if (value === 'none') {
      return 'none';
    }
    if (value === 'slash' || value === 'both' || value === 'prefix' || !value) {
      return 'prefix';
    }
    return 'prefix';
  }

  setCommandMode(commandKey, mode) {
    const validModes = ['prefix', 'none'];
    if (!commandKey || !validModes.includes(mode)) {
      return;
    }
    this.set(`commandAvailability.${commandKey}`, mode);
  }

  getCommandReasonRequirement(commandKey) {
    if (!commandKey) {
      return null;
    }
    const value = this.get(`enforceReasonByCommand.${commandKey}`);
    return typeof value === 'boolean' ? value : null;
  }

  setCommandReasonRequirement(commandKey, value) {
    if (!commandKey) {
      return;
    }
    if (value === null) {
      this.db.deleteSetting(`enforceReasonByCommand.${commandKey}`);
      return;
    }
    if (typeof value !== 'boolean') {
      return;
    }
    this.set(`enforceReasonByCommand.${commandKey}`, value);
  }

  clearCommandReasonRequirement(commandKey) {
    this.setCommandReasonRequirement(commandKey, null);
  }

  getCommandReasonBypassRoles(commandKey) {
    if (!commandKey) {
      return [];
    }
    const value = this.get(`commandReasonBypassRoles.${commandKey}`);
    return Array.isArray(value) ? value : [];
  }

  setCommandReasonBypassRoles(commandKey, roleIds) {
    if (!commandKey || !Array.isArray(roleIds)) {
      return;
    }
    this.set(`commandReasonBypassRoles.${commandKey}`, roleIds);
  }

  isReasonRequired(commandKey) {
    const neverRequireReason = new Set(['unmute', 'unban', 'unblacklist', 'baninfo', 'blinfo']);
    if (neverRequireReason.has(commandKey)) {
      return false;
    }
    if (commandKey) {
      const override = this.getCommandReasonRequirement(commandKey);
      if (override !== null) {
        return override;
      }
    }
    return Boolean(this.get('enforceReason'));
  }

  arePrefixCommandsEnabled() {
    return Boolean(this.get('enablePrefixCommands'));
  }

  getDefaultCooldownSeconds() {
    return Number(this.get('defaultCooldownSeconds')) || 0;
  }
}

module.exports = { ConfigService };
