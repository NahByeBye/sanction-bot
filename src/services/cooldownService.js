const DAY_IN_MS = 86_400_000;

class CooldownService {
  constructor(db) {
    this.db = db;
  }

  checkAndConsume(action, userId, { cooldownMs = 0, dailyLimit = null, now = Date.now() }) {
    let state = this.db.getCooldownState(action, userId);

    if (!state) {
      state = {
        lastUsed: 0,
        uses: 0,
        resetAt: now + DAY_IN_MS
      };
    }

    if (now >= state.resetAt) {
      state.uses = 0;
      state.resetAt = now + DAY_IN_MS;
    }

    if (cooldownMs > 0) {
      const readyAt = state.lastUsed + cooldownMs;
      if (state.lastUsed > 0 && now < readyAt) {
        return {
          allowed: false,
          retryAfter: readyAt - now,
          limitReached: false,
          remaining: readyAt - now
        };
      }
    }

    if (typeof dailyLimit === 'number' && dailyLimit > 0) {
      if (state.uses >= dailyLimit) {
        return {
          allowed: false,
          retryAfter: state.resetAt - now,
          limitReached: true,
          remaining: state.resetAt - now
        };
      }
    }

    state.lastUsed = now;
    state.uses += 1;
    this.db.upsertCooldownState(action, userId, state);

    return {
      allowed: true,
      retryAfter: 0,
      limitReached: false,
      remaining: cooldownMs
    };
  }
}

module.exports = { CooldownService };
