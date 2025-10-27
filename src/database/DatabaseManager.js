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
        reason TEXT NOT NULL,
        duration_ms INTEGER,
        created_at INTEGER NOT NULL,
        expires_at INTEGER,
        active INTEGER NOT NULL DEFAULT 1,
        revoked_at INTEGER,
        revoked_by_id TEXT,
        revoked_reason TEXT
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
        daily_limit INTEGER
      );

      CREATE TABLE IF NOT EXISTS cooldown_state (
        action TEXT NOT NULL,
        user_id TEXT NOT NULL,
        last_used INTEGER NOT NULL,
        uses INTEGER NOT NULL DEFAULT 0,
        reset_at INTEGER NOT NULL,
        PRIMARY KEY (action, user_id)
      );
    `;
    this.db.exec(ddl);
  }

  prepareStatements() {
    this.statements = {
      insertOwner: this.db.prepare(`INSERT OR IGNORE INTO owners (user_id, added_by, added_at, is_primary) VALUES (?, ?, ?, ?)`),
      removeOwner: this.db.prepare(`DELETE FROM owners WHERE user_id = ? AND is_primary = 0`),
      getOwners: this.db.prepare(`SELECT user_id, added_by, added_at, is_primary FROM owners`),
      insertSetting: this.db.prepare(`INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value`),
      getSetting: this.db.prepare(`SELECT value FROM settings WHERE key = ?`),
      insertSanction: this.db.prepare(`INSERT INTO sanctions (guild_id, type, target_id, target_tag, executor_id, executor_tag, reason, duration_ms, created_at, expires_at, active) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`),
      updateSanctionRevocation: this.db.prepare(`UPDATE sanctions SET active = 0, revoked_at = ?, revoked_by_id = ?, revoked_reason = ? WHERE id = ?`),
      getSanctionById: this.db.prepare(`SELECT * FROM sanctions WHERE id = ?`),
      listSanctions: this.db.prepare(`SELECT * FROM sanctions WHERE guild_id = ? AND target_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?`),
      listSanctionsByType: this.db.prepare(`SELECT * FROM sanctions WHERE guild_id = ? AND type = ? AND active = 1`),
      getDueSanctions: this.db.prepare(`SELECT * FROM sanctions WHERE active = 1 AND expires_at IS NOT NULL AND expires_at <= ?`),
      insertSanctionEvent: this.db.prepare(`INSERT INTO sanction_events (sanction_id, action, actor_id, actor_tag, timestamp, metadata) VALUES (?, ?, ?, ?, ?, ?)`),
      getSanctionEvents: this.db.prepare(`SELECT * FROM sanction_events WHERE sanction_id = ? ORDER BY timestamp ASC`),
      upsertPermission: this.db.prepare(`INSERT INTO permissions (action, role_ids, cooldown_ms, daily_limit) VALUES (?, ?, ?, ?) ON CONFLICT(action) DO UPDATE SET role_ids = excluded.role_ids, cooldown_ms = excluded.cooldown_ms, daily_limit = excluded.daily_limit`),
      getPermission: this.db.prepare(`SELECT * FROM permissions WHERE action = ?`),
      getAllPermissions: this.db.prepare(`SELECT * FROM permissions`),
      getCooldownState: this.db.prepare(`SELECT * FROM cooldown_state WHERE action = ? AND user_id = ?`),
      insertCooldownState: this.db.prepare(`INSERT OR REPLACE INTO cooldown_state (action, user_id, last_used, uses, reset_at) VALUES (?, ?, ?, ?, ?)`)
    };
  }

  addOwner(userId, addedBy, isPrimary = false) {
    const now = Date.now();
    this.statements.insertOwner.run(userId, addedBy, now, isPrimary ? 1 : 0);
  }

  removeOwner(userId) {
    this.statements.removeOwner.run(userId);
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
    const { executorId, executorTag, reason = 'Revoked', timestamp = Date.now(), metadata = null } = payload;
    this.statements.updateSanctionRevocation.run(timestamp, executorId, reason, sanctionId);
    this.recordSanctionEvent({
      sanctionId,
      action: 'REVOKED',
      actorId: executorId,
      actorTag: executorTag,
      timestamp,
      metadata
    });
    return this.statements.getSanctionById.get(sanctionId);
  }

  getSanctionById(id) {
    return this.statements.getSanctionById.get(id);
  }

  listSanctions(guildId, targetId, limit = 20, offset = 0) {
    return this.statements.listSanctions.all(guildId, targetId, limit, offset);
  }

  listActiveSanctionsByType(guildId, type) {
    return this.statements.listSanctionsByType.all(guildId, type);
  }

  getDueSanctions(now = Date.now()) {
    return this.statements.getDueSanctions.all(now);
  }

  setActionConfig(action, config) {
    const roleIds = JSON.stringify(config.roleIds || []);
    const cooldownMs = config.cooldownMs || 0;
    const dailyLimit = typeof config.dailyLimit === 'number' ? config.dailyLimit : null;
    this.statements.upsertPermission.run(action, roleIds, cooldownMs, dailyLimit);
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
      dailyLimit: row.daily_limit
    };
  }

  getAllActionConfigs() {
    const rows = this.statements.getAllPermissions.all();
    return rows.map((row) => ({
      action: row.action,
      roleIds: JSON.parse(row.role_ids || '[]'),
      cooldownMs: row.cooldown_ms,
      dailyLimit: row.daily_limit
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
}

module.exports = { DatabaseManager };
