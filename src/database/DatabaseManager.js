const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');

class DatabaseManager {
  constructor(dbPath, mainOwnerId) {
    this.dbPath = path.resolve(dbPath);
    const dir = path.dirname(this.dbPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    this.db = new Database(this.dbPath);
    this.db.pragma('journal_mode = WAL');
    this.prepareSchema();
    this.prepareStatements();
    if (mainOwnerId) {
      this.addOwner(mainOwnerId, mainOwnerId, true);
      this.addProtectedUser(mainOwnerId, mainOwnerId);
    }
  }

  prepareSchema() {
    const ddl = `
      CREATE TABLE IF NOT EXISTS owners (
        user_id TEXT PRIMARY KEY,
        added_by TEXT NOT NULL,
        added_at INTEGER NOT NULL,
        is_primary INTEGER NOT NULL DEFAULT 0
      );

      CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS sanctions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        guild_id TEXT NOT NULL,
        type TEXT NOT NULL,
        target_id TEXT NOT NULL,
        target_tag TEXT,
        executor_id TEXT NOT NULL,
        executor_tag TEXT,
        reason TEXT,
        created_at INTEGER NOT NULL,
        expires_at INTEGER,
        active INTEGER NOT NULL DEFAULT 1,
        revoked_reason TEXT,
        revoked_at INTEGER,
        metadata TEXT
      );

      CREATE TABLE IF NOT EXISTS sanction_events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        sanction_id INTEGER NOT NULL,
        action TEXT NOT NULL,
        actor_id TEXT NOT NULL,
        actor_tag TEXT,
        timestamp INTEGER NOT NULL,
        metadata TEXT,
        FOREIGN KEY (sanction_id) REFERENCES sanctions(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS permissions (
        action TEXT PRIMARY KEY,
        role_ids TEXT NOT NULL DEFAULT '[]',
        cooldown_ms INTEGER NOT NULL DEFAULT 0,
        daily_limit INTEGER,
        limit_window_seconds INTEGER NOT NULL DEFAULT 86400
      );

      CREATE TABLE IF NOT EXISTS whitelist (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        guild_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        added_by TEXT NOT NULL,
        added_at INTEGER NOT NULL,
        UNIQUE(guild_id, user_id)
      );

      CREATE TABLE IF NOT EXISTS cooldown_state (
        action TEXT NOT NULL,
        user_id TEXT NOT NULL,
        last_used INTEGER NOT NULL,
        uses INTEGER NOT NULL DEFAULT 0,
        reset_at INTEGER NOT NULL,
        PRIMARY KEY (action, user_id)
      );

      CREATE TABLE IF NOT EXISTS guild_roles (
        guild_id TEXT NOT NULL,
        role_type TEXT NOT NULL,
        role_id TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        PRIMARY KEY (guild_id, role_type)
      );

      CREATE TABLE IF NOT EXISTS whitelist_role_limits (
        guild_id TEXT NOT NULL,
        role_id TEXT NOT NULL,
        action_key TEXT NOT NULL DEFAULT 'all',
        daily_limit INTEGER NOT NULL DEFAULT 0,
        cooldown_ms INTEGER NOT NULL DEFAULT 0,
        PRIMARY KEY (guild_id, role_id, action_key)
      );

      CREATE TABLE IF NOT EXISTS protected_users (
        user_id TEXT PRIMARY KEY,
        added_by TEXT NOT NULL,
        added_at INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS punishments (
        user_id TEXT PRIMARY KEY,
        added_by TEXT NOT NULL,
        added_at INTEGER NOT NULL,
        duration_ms INTEGER NOT NULL,
        expires_at INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS connection_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id TEXT NOT NULL,
        guild_id TEXT NOT NULL,
        ip_address TEXT,
        user_agent TEXT,
        joined_at INTEGER NOT NULL,
        device_fingerprint TEXT
      );
    `;
    this.db.exec(ddl);

    const permissionColumns = this.db.prepare("PRAGMA table_info('permissions')").all();
    const hasLimitWindow = permissionColumns.some((column) => column.name === 'limit_window_seconds');
    if (!hasLimitWindow) {
      this.db.prepare('ALTER TABLE permissions ADD COLUMN limit_window_seconds INTEGER NOT NULL DEFAULT 86400').run();
    }

    const sanctionColumns = this.db.prepare("PRAGMA table_info('sanctions')").all();
    const hasMetadata = sanctionColumns.some((column) => column.name === 'metadata');
    if (!hasMetadata) {
      this.db.prepare('ALTER TABLE sanctions ADD COLUMN metadata TEXT').run();
    }
  }

  prepareStatements() {
    this.statements = {
      insertOwner: this.db.prepare(`INSERT OR IGNORE INTO owners (user_id, added_by, added_at, is_primary) VALUES (?, ?, ?, ?)`),
      removeOwner: this.db.prepare(`DELETE FROM owners WHERE user_id = ? AND is_primary = 0`),
      getOwners: this.db.prepare(`SELECT user_id, added_by, added_at, is_primary FROM owners`),
      insertSetting: this.db.prepare(`INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value`),
      deleteSetting: this.db.prepare(`DELETE FROM settings WHERE key = ?`),
      getSetting: this.db.prepare(`SELECT value FROM settings WHERE key = ?`),
      insertSanction: this.db.prepare(`INSERT INTO sanctions (guild_id, type, target_id, target_tag, executor_id, executor_tag, reason, duration_ms, created_at, expires_at, active) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`),
      updateSanctionRevocation: this.db.prepare(`UPDATE sanctions SET active = 0, revoked_at = ?, revoked_by_id = ?, revoked_reason = ? WHERE id = ?`),
      getSanctionById: this.db.prepare(`SELECT * FROM sanctions WHERE id = ?`),
      listSanctions: this.db.prepare(`SELECT * FROM sanctions WHERE guild_id = ? AND target_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?`),
      listSanctionsByType: this.db.prepare(`SELECT * FROM sanctions WHERE guild_id = ? AND type = ? AND active = 1`),
      getDueSanctions: this.db.prepare(`SELECT * FROM sanctions WHERE active = 1 AND expires_at IS NOT NULL AND expires_at <= ?`),
      insertSanctionEvent: this.db.prepare(`INSERT INTO sanction_events (sanction_id, action, actor_id, actor_tag, timestamp, metadata) VALUES (?, ?, ?, ?, ?, ?)`),
      getSanctionEvents: this.db.prepare(`SELECT * FROM sanction_events WHERE sanction_id = ? ORDER BY timestamp ASC`),
      upsertPermission: this.db.prepare(`INSERT INTO permissions (action, role_ids, cooldown_ms, daily_limit, limit_window_seconds) VALUES (?, ?, ?, ?, ?) ON CONFLICT(action) DO UPDATE SET role_ids = excluded.role_ids, cooldown_ms = excluded.cooldown_ms, daily_limit = excluded.daily_limit, limit_window_seconds = excluded.limit_window_seconds`),
      getPermission: this.db.prepare(`SELECT * FROM permissions WHERE action = ?`),
      getAllPermissions: this.db.prepare(`SELECT * FROM permissions`),
      getCooldownState: this.db.prepare(`SELECT * FROM cooldown_state WHERE action = ? AND user_id = ?`),
      insertCooldownState: this.db.prepare(`INSERT OR REPLACE INTO cooldown_state (action, user_id, last_used, uses, reset_at) VALUES (?, ?, ?, ?, ?)`),
      clearActiveSanctionsByType: this.db.prepare(`SELECT * FROM sanctions WHERE guild_id = ? AND target_id = ? AND type = ? AND active = 1`),
      clearActiveSanctionsAll: this.db.prepare(`SELECT * FROM sanctions WHERE guild_id = ? AND target_id = ? AND active = 1`),
      deleteSanctionById: this.db.prepare(`DELETE FROM sanctions WHERE id = ?`),
      deleteSanctionEvents: this.db.prepare(`DELETE FROM sanction_events WHERE sanction_id = ?`),
      deleteSanctions: this.db.prepare(`DELETE FROM sanctions WHERE guild_id = ? AND target_id = ? AND active = 1 AND type = ?`),
      setGuildRole: this.db.prepare(`INSERT OR REPLACE INTO guild_roles (guild_id, role_type, role_id, created_at) VALUES (?, ?, ?, ?)`),
      getGuildRole: this.db.prepare(`SELECT role_id FROM guild_roles WHERE guild_id = ? AND role_type = ?`),
      deleteGuildRole: this.db.prepare(`DELETE FROM guild_roles WHERE guild_id = ? AND role_type = ?`),
      setWhitelistRoleLimit: this.db.prepare(`INSERT OR REPLACE INTO whitelist_role_limits (guild_id, role_id, action_key, daily_limit, cooldown_ms) VALUES (?, ?, ?, ?, ?)`),
      getWhitelistRoleLimit: this.db.prepare(`SELECT * FROM whitelist_role_limits WHERE guild_id = ? AND role_id = ? AND action_key = ?`),
      getAllWhitelistRoleLimits: this.db.prepare(`SELECT * FROM whitelist_role_limits WHERE guild_id = ?`),
      deleteWhitelistRoleLimit: this.db.prepare(`DELETE FROM whitelist_role_limits WHERE guild_id = ? AND role_id = ? AND action_key = ?`),
      isUserWhitelisted: this.db.prepare(`SELECT * FROM whitelist WHERE guild_id = ? AND user_id = ?`),
      addProtectedUser: this.db.prepare(`INSERT OR REPLACE INTO protected_users (user_id, added_by, added_at) VALUES (?, ?, ?)`),
      removeProtectedUser: this.db.prepare(`DELETE FROM protected_users WHERE user_id = ?`),
      isUserProtected: this.db.prepare(`SELECT * FROM protected_users WHERE user_id = ?`),
      getAllProtectedUsers: this.db.prepare(`SELECT * FROM protected_users`),
      addPunishment: this.db.prepare(`INSERT OR REPLACE INTO punishments (user_id, added_by, added_at, duration_ms, expires_at) VALUES (?, ?, ?, ?, ?)`),
      removePunishment: this.db.prepare(`DELETE FROM punishments WHERE user_id = ?`),
      getPunishment: this.db.prepare(`SELECT * FROM punishments WHERE user_id = ?`),
      getAllPunishments: this.db.prepare(`SELECT * FROM punishments`),
      getExpiredPunishments: this.db.prepare(`SELECT * FROM punishments WHERE expires_at <= ?`),
      logConnection: this.db.prepare(`INSERT INTO connection_logs (user_id, guild_id, ip_address, user_agent, joined_at, device_fingerprint) VALUES (?, ?, ?, ?, ?, ?)`),
      getConnectionLogs: this.db.prepare(`SELECT * FROM connection_logs WHERE user_id = ? ORDER BY joined_at DESC`),
      getRecentConnections: this.db.prepare(`SELECT * FROM connection_logs WHERE guild_id = ? AND joined_at > ? ORDER BY joined_at DESC`),
      getBlacklistedConnections: this.db.prepare(`SELECT cl.* FROM connection_logs cl JOIN sanctions s ON cl.user_id = s.target_id WHERE s.guild_id = ? AND s.type IN ('BLACKLIST', 'TEMPBLACKLIST') AND s.active = 1`)
    };
  }

  addOwner(userId, addedBy, isPrimary = false) {
    const now = Date.now();
    this.statements.insertOwner.run(userId, addedBy, now, isPrimary ? 1 : 0);
  }

  removeOwner(userId) {
    const primaryOwnerId = this.getSetting('ownerId');
    if (userId === primaryOwnerId) {
      return false;
    }
    this.db.prepare(`DELETE FROM owners WHERE user_id = ?`).run(userId);
    return true;
  }

  getOwners() {
    return this.statements.getOwners.all();
  }

  isOwner(userId) {
    const owners = this.getOwners();
    return owners.some((owner) => owner.user_id === userId);
  }

  setSetting(key, value) {
    const payload = JSON.stringify(value);
    this.statements.insertSetting.run(key, payload);
  }

  deleteSetting(key) {
    this.statements.deleteSetting.run(key);
  }

  getSetting(key, defaultValue = null) {
    const row = this.statements.getSetting.get(key);
    if (!row) {
      return defaultValue;
    }
    try {
      return JSON.parse(row.value);
    } catch (error) {
      return defaultValue;
    }
  }

  recordSanction(payload) {
    const {
      guildId,
      type,
      targetId,
      targetTag,
      executorId,
      executorTag,
      reason,
      durationMs = null,
      createdAt = Date.now()
    } = payload;
    const expiresAt = durationMs ? createdAt + durationMs : null;
    const result = this.statements.insertSanction.run(
      guildId,
      type,
      targetId,
      targetTag,
      executorId,
      executorTag,
      reason,
      durationMs,
      createdAt,
      expiresAt
    );
    const sanctionId = result.lastInsertRowid;
    this.recordSanctionEvent({
      sanctionId,
      action: 'APPLIED',
      actorId: executorId,
      actorTag: executorTag,
      metadata: payload.metadata || null,
      timestamp: createdAt
    });
    return this.statements.getSanctionById.get(sanctionId);
  }

  recordSanctionEvent({ sanctionId, action, actorId, actorTag, timestamp = Date.now(), metadata = null }) {
    const metadataPayload = metadata ? JSON.stringify(metadata) : null;
    this.statements.insertSanctionEvent.run(
      sanctionId,
      action,
      actorId,
      actorTag,
      timestamp,
      metadataPayload
    );
  }

  revokeSanction(sanctionId, payload) {
    const { executorId, executorTag, reason } = payload;
    const now = Date.now();
    this.statements.updateSanctionRevocation.run(now, executorId, reason, sanctionId);
    this.recordSanctionEvent({
      sanctionId,
      action: 'REVOKED',
      actorId: executorId,
      actorTag: executorTag,
      timestamp: now
    });
    return this.statements.getSanctionById.get(sanctionId);
  }

  getSanctionById(id) {
    return this.statements.getSanctionById.get(id);
  }

  listSanctions(guildId, targetId, limit = 20, offset = 0) {
    return this.statements.listSanctions.all(guildId, targetId, limit, offset).filter((s) => s.active === 1);
  }

  listSanctionHistory(guildId, targetId, limit = 100, offset = 0) {
    return this.statements.listSanctions.all(guildId, targetId, limit, offset);
  }

  listActiveSanctionsByType(guildId, type) {
    return this.statements.listSanctionsByType.all(guildId, type);
  }

  listGuildActiveBlacklists(guildId) {
    const query = `SELECT * FROM sanctions WHERE guild_id = ? AND active = 1 AND type IN ('BLACKLIST', 'TEMPBLACKLIST') ORDER BY created_at ASC`;
    return this.db.prepare(query).all(guildId);
  }

  listSanctionsByExecutor(guildId, executorId, types = []) {
    if (!Array.isArray(types) || types.length === 0) {
      return [];
    }
    const placeholders = types.map(() => '?').join(',');
    const query = `SELECT * FROM sanctions WHERE guild_id = ? AND executor_id = ? AND type IN (${placeholders}) AND active = 1 AND executor_id != 'SYSTEM' AND executor_id != ? ORDER BY created_at DESC`;
    const stmt = this.db.prepare(query);
    return stmt.all(guildId, executorId, ...types, guildId);
  }

  getDueSanctions(now = Date.now()) {
    return this.statements.getDueSanctions.all(now);
  }

  setActionConfig(action, config) {
    const roleIds = JSON.stringify(config.roleIds || []);
    const cooldownMs = config.cooldownMs || 0;
    const dailyLimit = typeof config.dailyLimit === 'number' ? config.dailyLimit : null;
    const limitWindowSeconds = typeof config.limitWindowSeconds === 'number' ? config.limitWindowSeconds : 86400;
    this.statements.upsertPermission.run(action, roleIds, cooldownMs, dailyLimit, limitWindowSeconds);
  }

  getActionConfig(action) {
    const row = this.statements.getPermission.get(action);
    if (!row) {
      return null;
    }
    return {
      action: row.action,
      roleIds: JSON.parse(row.role_ids || '[]'),
      cooldownMs: row.cooldown_ms,
      dailyLimit: row.daily_limit,
      limitWindowSeconds: typeof row.limit_window_seconds === 'number' ? row.limit_window_seconds : 86400
    };
  }

  getAllActionConfigs() {
    const rows = this.statements.getAllPermissions.all();
    return rows.map((row) => ({
      action: row.action,
      roleIds: JSON.parse(row.role_ids || '[]'),
      cooldownMs: row.cooldown_ms,
      dailyLimit: row.daily_limit,
      limitWindowSeconds: typeof row.limit_window_seconds === 'number' ? row.limit_window_seconds : 86400
    }));
  }

  getCooldownState(action, userId) {
    const row = this.statements.getCooldownState.get(action, userId);
    if (!row) {
      return null;
    }
    return {
      action: row.action,
      userId: row.user_id,
      lastUsed: row.last_used,
      uses: row.uses,
      resetAt: row.reset_at
    };
  }

  upsertCooldownState(action, userId, state) {
    this.statements.insertCooldownState.run(action, userId, state.lastUsed, state.uses, state.resetAt);
  }

  getSanctionEvents(id) {
    return this.statements.getSanctionEvents.all(id);
  }

  findActiveSanction(guildId, targetId, types = []) {
    if (!Array.isArray(types) || types.length === 0) {
      return null;
    }
    const placeholders = types.map(() => '?').join(',');
    const query = `SELECT * FROM sanctions WHERE guild_id = ? AND target_id = ? AND type IN (${placeholders}) AND active = 1 ORDER BY created_at DESC LIMIT 1`;
    const stmt = this.db.prepare(query);
    return stmt.get(guildId, targetId, ...types);
  }

  setGuildRole(guildId, roleType, roleId) {
    const now = Date.now();
    this.statements.setGuildRole.run(guildId, roleType, roleId, now);
  }

  getGuildRole(guildId, roleType) {
    const row = this.statements.getGuildRole.get(guildId, roleType);
    return row ? row.role_id : null;
  }

  deleteGuildRole(guildId, roleType) {
    this.statements.deleteGuildRole.run(guildId, roleType);
  }

  setWhitelistRoleLimit(guildId, roleId, actionKey, dailyLimit, cooldownMs) {
    this.statements.setWhitelistRoleLimit.run(guildId, roleId, actionKey, dailyLimit, cooldownMs);
  }

  getWhitelistRoleLimit(guildId, roleId, actionKey = 'all') {
    const row = this.statements.getWhitelistRoleLimit.get(guildId, roleId, actionKey);
    if (!row) {
      return null;
    }
    return {
      guildId: row.guild_id,
      roleId: row.role_id,
      actionKey: row.action_key,
      dailyLimit: row.daily_limit,
      cooldownMs: row.cooldown_ms
    };
  }

  getAllWhitelistRoleLimits(guildId) {
    const rows = this.statements.getAllWhitelistRoleLimits.all(guildId);
    return rows.map(row => ({
      guildId: row.guild_id,
      roleId: row.role_id,
      actionKey: row.action_key,
      dailyLimit: row.daily_limit,
      cooldownMs: row.cooldown_ms
    }));
  }

  deleteWhitelistRoleLimit(guildId, roleId, actionKey = 'all') {
    this.statements.deleteWhitelistRoleLimit.run(guildId, roleId, actionKey);
  }

  isUserWhitelisted(guildId, userId) {
    const row = this.statements.isUserWhitelisted.get(guildId, userId);
    return !!row;
  }

  addProtectedUser(userId, addedBy) {
    const now = Date.now();
    this.statements.addProtectedUser.run(userId, addedBy, now);
  }

  removeProtectedUser(userId) {
    this.statements.removeProtectedUser.run(userId);
  }

  isUserProtected(userId) {
    const row = this.statements.isUserProtected.get(userId);
    return !!row;
  }

  getAllProtectedUsers() {
    const rows = this.statements.getAllProtectedUsers.all();
    return rows.map(row => ({
      userId: row.user_id,
      addedBy: row.added_by,
      addedAt: row.added_at
    }));
  }

  addPunishment(userId, addedBy, durationMs) {
    const now = Date.now();
    const expiresAt = now + durationMs;
    this.statements.addPunishment.run(userId, addedBy, now, durationMs, expiresAt);
  }

  removePunishment(userId) {
    this.statements.removePunishment.run(userId);
  }

  getPunishment(userId) {
    const row = this.statements.getPunishment.get(userId);
    if (!row) {
      return null;
    }
    return {
      userId: row.user_id,
      addedBy: row.added_by,
      addedAt: row.added_at,
      durationMs: row.duration_ms,
      expiresAt: row.expires_at
    };
  }

  getAllPunishments() {
    const rows = this.statements.getAllPunishments.all();
    return rows.map(row => ({
      userId: row.user_id,
      addedBy: row.added_by,
      addedAt: row.added_at,
      durationMs: row.duration_ms,
      expiresAt: row.expires_at
    }));
  }

  getExpiredPunishments(now = Date.now()) {
    const rows = this.statements.getExpiredPunishments.all(now);
    return rows.map(row => ({
      userId: row.user_id,
      addedBy: row.added_by,
      addedAt: row.added_at,
      durationMs: row.duration_ms,
      expiresAt: row.expires_at
    }));
  }

  isUserPunished(userId) {
    const punishment = this.getPunishment(userId);
    if (!punishment) {
      return false;
    }
    if (punishment.expiresAt <= Date.now()) {
      this.removePunishment(userId);
      return false;
    }
    return true;
  }

  logConnection(userId, guildId, ipAddress = null, userAgent = null, deviceFingerprint = null) {
    const now = Date.now();
    this.statements.logConnection.run(userId, guildId, ipAddress, userAgent, now, deviceFingerprint);
  }

  getConnectionLogs(userId) {
    return this.statements.getConnectionLogs.all(userId);
  }

  getRecentConnections(guildId, since = Date.now() - 86400000) {
    return this.statements.getRecentConnections.all(guildId, since);
  }

  getBlacklistedConnections(guildId) {
    return this.statements.getBlacklistedConnections.all(guildId);
  }

  detectAltAccount(guildId, newUserId) {
    const blacklistedConnections = this.getBlacklistedConnections(guildId);
    if (blacklistedConnections.length === 0) {
      return null;
    }

    const newConnections = this.getConnectionLogs(newUserId);
    if (newConnections.length === 0) {
      return null;
    }

    for (const newConn of newConnections) {
      for (const blacklistedConn of blacklistedConnections) {
        if (newConn.ip_address && newConn.ip_address === blacklistedConn.ip_address) {
          return {
            matchedUserId: blacklistedConn.user_id,
            matchType: 'ip_address',
            ipAddress: newConn.ip_address
          };
        }
        if (newConn.device_fingerprint && newConn.device_fingerprint === blacklistedConn.device_fingerprint) {
          return {
            matchedUserId: blacklistedConn.user_id,
            matchType: 'device_fingerprint',
            fingerprint: newConn.device_fingerprint
          };
        }
      }
    }

    return null;
  }

  listActiveSanctions(guildId, targetId, typeFilter = null) {
    return typeFilter
      ? this.statements.clearActiveSanctionsByType.all(guildId, targetId, typeFilter)
      : this.statements.clearActiveSanctionsAll.all(guildId, targetId);
  }

  clearActiveSanctions(guildId, targetId, executionerId, executionerTag, reason, typeFilter = null) {
    const sanctionsToClear = typeFilter
      ? this.statements.clearActiveSanctionsByType.all(guildId, targetId, typeFilter)
      : this.statements.clearActiveSanctionsAll.all(guildId, targetId);

    const clearedIds = [];
    const now = Date.now();
    for (const sanction of sanctionsToClear) {
      this.statements.updateSanctionRevocation.run(now, executionerId, reason, sanction.id);
      this.recordSanctionEvent({
        sanctionId: sanction.id,
        action: 'REVOKED',
        actorId: executionerId,
        actorTag: executionerTag,
        timestamp: now
      });
      clearedIds.push(sanction.id);
    }

    return clearedIds;
  }
}

module.exports = { DatabaseManager };
