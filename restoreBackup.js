#!/usr/bin/env node

/**
 * restore-backup.js
 * Script utilitaire pour restaurer la base de données depuis un backup
 * 
 * Usage:
 *   node restoreBackup.js list              - Lister les backups disponibles
 *   node restoreBackup.js restore <file>   - Restaurer depuis un backup spécifique
 */

const readline = require('readline');
const config = require('./config');
const { BackupService } = require('./src/services/backupService');

const backupService = new BackupService(config);

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function askQuestion(query) {
  return new Promise((resolve) => {
    rl.question(query, resolve);
  });
}

async function listBackups() {
  console.log('\n Backups disponibles:\n');
  const backups = backupService.listBackups();

  if (backups.length === 0) {
    console.log('   Aucun backup trouvé.');
    return;
  }

  backups.forEach((backup, index) => {
    const dateStr = backup.created.toLocaleString('fr-FR');
    const sizeStr = backup.sizeKB;
    console.log(`   [${index}] ${backup.filename}`);
    console.log(`       Date: ${dateStr}`);
    console.log(`       Taille: ${sizeStr}KB\n`);
  });
}

async function restoreBackup(filename) {
  if (!filename) {
    console.error(' Nom de fichier requis');
    process.exit(1);
  }

  try {
    // Confirmation
    const confirm = await askQuestion(
      `\n  Êtes-vous sûr de vouloir restaurer depuis "${filename}"? (oui/non): `
    );

    if (confirm.toLowerCase() !== 'oui' && confirm.toLowerCase() !== 'yes') {
      console.log(' Restauration annulée.');
      process.exit(0);
    }

    console.log('\n⏳ Restauration en cours...');
    const result = await backupService.restoreFromBackup(filename);
    console.log(` Restauration réussie! ${result.restoredAt.toLocaleString('fr-FR')}`);
  } catch (error) {
    console.error(` Erreur: ${error.message}`);
    process.exit(1);
  }
}

async function showStats() {
  console.log('\n Statistiques de backup:\n');
  const stats = backupService.getStats();

  console.log(`   ✓ Backups activés: ${stats.backupEnabled ? 'Oui' : 'Non'}`);
  console.log(`   ✓ Intervalle: ${stats.backupInterval}`);
  console.log(`   ✓ Nombre de backups: ${stats.backupCount}/${stats.maxBackups}`);
  console.log(`   ✓ Taille totale: ${stats.totalSize}`);
  console.log(`   ✓ Dernier backup: ${stats.lastBackup}\n`);

  if (stats.backups.length > 0) {
    console.log('   Détails des backups:');
    stats.backups.forEach((b) => {
      console.log(`     • ${b.filename} (${b.size}) - ${b.date}`);
    });
  }
  console.log('');
}

async function main() {
  const args = process.argv.slice(2);
  const command = args[0];

  console.log('\n=== 🔄 Gestionnaire de Backup ===\n');

  try {
    if (!command || command === 'help') {
      console.log('Commandes disponibles:\n');
      console.log('   list      - Lister les backups disponibles');
      console.log('   stats     - Afficher les statistiques');
      console.log('   restore   - Restaurer depuis un backup interactif');
      console.log('   restore <file> - Restaurer depuis un fichier spécifique\n');
    } else if (command === 'list') {
      await listBackups();
    } else if (command === 'stats') {
      await showStats();
    } else if (command === 'restore') {
      const filename = args[1];

      if (filename) {
        await restoreBackup(filename);
      } else {
        // Mode interactif
        await listBackups();
        const fileInput = await askQuestion('Entrez le numéro du backup ou le nom du fichier: ');
        const backups = backupService.listBackups();

        let selectedFile = fileInput;
        if (!isNaN(fileInput)) {
          const index = parseInt(fileInput, 10);
          if (index >= 0 && index < backups.length) {
            selectedFile = backups[index].filename;
          }
        }

        await restoreBackup(selectedFile);
      }
    } else {
      console.error(` Commande inconnue: ${command}`);
      console.log('\nUtilisez "node restoreBackup.js help" pour l\'aide.\n');
      process.exit(1);
    }
  } catch (error) {
    console.error(` Erreur: ${error.message}`);
    process.exit(1);
  } finally {
    rl.close();
    process.exit(0);
  }
}

main();
