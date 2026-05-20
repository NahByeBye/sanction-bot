class Metrics {
  constructor() {
    this.metrics = {
      sanctions: {
        total: 0,
        byType: {},
        today: 0
      },
      commands: {
        total: 0,
        byCommand: {},
        errors: 0
      },
      errors: {
        total: 0,
        byType: {}
      },
      uptime: Date.now()
    };
  }

  incrementSanction(type) {
    this.metrics.sanctions.total++;
    this.metrics.sanctions.byType[type] = (this.metrics.sanctions.byType[type] || 0) + 1;
    this.metrics.sanctions.today++;
  }

  incrementCommand(commandName) {
    this.metrics.commands.total++;
    this.metrics.commands.byCommand[commandName] = (this.metrics.commands.byCommand[commandName] || 0) + 1;
  }

  incrementCommandError() {
    this.metrics.commands.errors++;
  }

  incrementError(errorType) {
    this.metrics.errors.total++;
    this.metrics.errors.byType[errorType] = (this.metrics.errors.byType[errorType] || 0) + 1;
  }

  getStats() {
    const uptime = Date.now() - this.metrics.uptime;
    const hours = Math.floor(uptime / 3600000);
    const minutes = Math.floor((uptime % 3600000) / 60000);

    return {
      ...this.metrics,
      uptime: `${hours}h ${minutes}m`,
      uptimeMs: uptime
    };
  }

  resetDailyStats() {
    this.metrics.sanctions.today = 0;
  }
}

module.exports = new Metrics();
