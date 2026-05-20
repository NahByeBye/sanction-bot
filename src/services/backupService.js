const fs = require('fs').promises;
const fsSync = require('fs');
const path = require('path');
const zlib = require('zlib');

class BackupService {
  constructor(config) {
    this.config = {
      enabled: config.backupEnabled !== false,
      interval: config.backupIntervalMinutes || 60,
      maxBackups: config.maxBackups || 10,
      backupDir: config.backupDir || './data/backups',
      dbPath: config.databasePath || './data/sanctions.sqlite'
    };

    if (!fsSync.existsSync(this.config.backupDir)) {
      fsSync.mkdirSync(this.config.backupDir, { recursive: true });
    }

    this.backupSchedule = null;
    this.lastBackupTime = null;
    this.backupInProgress = false;
  }

  startScheduler() {
    if (!this.config.enabled || this.backupSchedule) {
      return;
    }

    console.log(`backup started ${this.config.interval}min`);
    this.backupSchedule = setInterval(() => {
      this.performBackup().catch((error) => {
        console.error('backup error:', error.message);
      });
    }, this.config.interval * 60 * 1000);

    setImmediate(() => {
      this.performBackup().catch((error) => {
        console.error('backup error:', error.message);
      });
    });
  }

  stopScheduler() {
    if (this.backupSchedule) {
      clearInterval(this.backupSchedule);
      this.backupSchedule = null;
      console.log('backup stopped');
    }
  }

  async performBackup() {
    if (this.backupInProgress) {
      console.warn('backup in progress');
      return null;
    }

    this.backupInProgress = true;

    try {
      if (!fsSync.existsSync(this.config.dbPath)) {
        throw new Error(`Base de données introuvable: ${this.config.dbPath}`);
      }

      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const backupFileName = `backup-${timestamp}.sqlite`;
      const backupFilePath = path.join(this.config.backupDir, backupFileName);
      const compressedPath = `${backupFilePath}.gz`;

      const fileBuffer = await fs.readFile(this.config.dbPath);
      await fs.writeFile(backupFilePath, fileBuffer);

      await this._compressFile(backupFilePath, compressedPath);
      await fs.unlink(backupFilePath);

      this.lastBackupTime = Date.now();

      await this._cleanupOldBackups();

      const stats = await fs.stat(compressedPath);
      const fileSize = (stats.size / 1024).toFixed(2);
      console.log(`backup created ${backupFileName}.gz ${fileSize}KB`);

      return {
        filename: `${backupFileName}.gz`,
        path: compressedPath,
        timestamp: new Date(timestamp),
        size: stats.size
      };
    } catch (error) {
      console.error('backup error:', error.message);
      throw error;
    } finally {
      this.backupInProgress = false;
    }
  }

  async listBackups() {
    try {
      const files = await fs.readdir(this.config.backupDir);
      const backups = files
        .filter((f) => f.startsWith('backup-') && f.endsWith('.sqlite.gz'))
        .map((filename) => {
          const filepath = path.join(this.config.backupDir, filename);
          const dateMatch = filename.match(/backup-(.+?)\.sqlite\.gz/);
          const timestamp = dateMatch ? dateMatch[1].replace(/-/g, ':') : 'unknown';

          return {
            filename,
            path: filepath,
            timestamp: new Date(timestamp)
          };
        });

      const backupsWithStats = await Promise.all(backups.map(async (backup) => {
        const stats = await fs.stat(backup.path);
        return {
          ...backup,
          size: stats.size,
          sizeKB: (stats.size / 1024).toFixed(2),
          created: stats.mtime
        };
      }));

      return backupsWithStats.sort((a, b) => b.created - a.created);
    } catch (error) {
      console.error('backup list error:', error.message);
      return [];
    }
  }

  async restoreFromBackup(backupFilename) {
    try {
      const backupPath = path.join(this.config.backupDir, backupFilename);

      if (!fsSync.existsSync(backupPath)) {
        throw new Error(`Backup introuvable: ${backupFilename}`);
      }

      if (!backupFilename.endsWith('.gz')) {
        throw new Error('Seuls les backups compressés (.gz) peuvent être restaurés');
      }

      const currentDbPath = this.config.dbPath;
      if (fsSync.existsSync(currentDbPath)) {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const preRestoreBackup = path.join(this.config.backupDir, `pre-restore-${timestamp}.sqlite.gz`);
        await this._compressFile(currentDbPath, preRestoreBackup);
        console.log(`backup pre-restore ${timestamp}`);
      }

      const tempPath = `${backupPath}.temp`;
      await this._decompressFile(backupPath, tempPath);

      if (!fsSync.existsSync(tempPath)) {
        throw new Error('Échec de décompression du backup');
      }

      await fs.copyFile(tempPath, currentDbPath);
      await fs.unlink(tempPath);

      console.log(`backup restored ${backupFilename}`);

      return {
        success: true,
        filename: backupFilename,
        restoredAt: new Date()
      };
    } catch (error) {
      console.error('backup restore error:', error.message);
      throw error;
    }
  }

  async getStats() {
    const backups = await this.listBackups();
    const totalSize = backups.reduce((sum, b) => sum + b.size, 0);

    return {
      backupEnabled: this.config.enabled,
      backupInterval: `${this.config.interval}min`,
      maxBackups: this.config.maxBackups,
      backupCount: backups.length,
      totalSize: `${(totalSize / 1024 / 1024).toFixed(2)}MB`,
      lastBackup: this.lastBackupTime ? new Date(this.lastBackupTime) : 'Jamais',
      backups: backups.map((b) => ({
        filename: b.filename,
        size: `${b.sizeKB}KB`,
        date: b.created.toLocaleString('fr-FR')
      }))
    };
  }

  async deleteBackupAtIndex(index) {
    const backups = await this.listBackups();
    if (!Number.isInteger(index) || index < 1 || index > backups.length) {
      throw new Error(`Numéro invalide. Choisissez entre 1 et ${backups.length || 1}.`);
    }

    const backup = backups[index - 1];
    await fs.unlink(backup.path);
    console.log(`backup deleted ${backup.filename}`);
    return backup;
  }

  async clearAllBackups() {
    const backups = await this.listBackups();
    for (const backup of backups) {
      await fs.unlink(backup.path);
      console.log(`backup deleted ${backup.filename}`);
    }
    return backups.length;
  }

  async _cleanupOldBackups() {
    try {
      const backups = await this.listBackups();

      if (backups.length <= this.config.maxBackups) {
        return;
      }

      const toDelete = backups.slice(this.config.maxBackups);
      for (const backup of toDelete) {
        await fs.unlink(backup.path);
        console.log(`backup deleted ${backup.filename}`);
      }
    } catch (error) {
      console.error('backup cleanup error:', error.message);
    }
  }

  _compressFile(inputPath, outputPath) {
    return new Promise((resolve, reject) => {
      const input = fsSync.createReadStream(inputPath);
      const output = fsSync.createWriteStream(outputPath);
      const gzip = zlib.createGzip();

      input
        .pipe(gzip)
        .pipe(output)
        .on('finish', resolve)
        .on('error', reject);

      input.on('error', reject);
      gzip.on('error', reject);
    });
  }

  _decompressFile(inputPath, outputPath) {
    return new Promise((resolve, reject) => {
      const input = fsSync.createReadStream(inputPath);
      const output = fsSync.createWriteStream(outputPath);
      const gunzip = zlib.createGunzip();

      input
        .pipe(gunzip)
        .pipe(output)
        .on('finish', resolve)
        .on('error', reject);

      input.on('error', reject);
      gunzip.on('error', reject);
    });
  }
}

module.exports = { BackupService };
