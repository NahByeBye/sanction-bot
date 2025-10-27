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

  isReasonRequired() {
    return Boolean(this.get('enforceReason'));
  }

  areSlashCommandsEnabled() {
    return Boolean(this.get('enableSlashCommands'));
  }

  arePrefixCommandsEnabled() {
    return Boolean(this.get('enablePrefixCommands'));
  }

  getDefaultCooldownSeconds() {
    return Number(this.get('defaultCooldownSeconds')) || 0;
  }
}

module.exports = { ConfigService };
