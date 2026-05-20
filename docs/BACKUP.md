# 🔄 Système de Backup - Documentation

## Vue d'ensemble

Le système de backup automatique protège vos données en créant des copies compressées de la base de données SQLite à intervalles réguliers.

## Configuration

Les paramètres de backup se trouvent dans `config.js` :

```javascript
{
  // Backup configuration
  backupEnabled: true,           // Activer/désactiver les backups automatiques
  backupIntervalMinutes: 60,     // Intervalle entre les backups (en minutes)
  maxBackups: 10,                // Nombre maximum de backups à conserver
  backupDir: "./data/backups"    // Répertoire de stockage des backups
}
```

## Fonctionnement automatique

- **Démarrage** : Les backups commencent automatiquement au lancement du bot
- **Intervalle** : Par défaut, un backup est créé toutes les heures
- **Stockage** : Les backups sont compressés en `.sqlite.gz` pour économiser l'espace
- **Rotation** : Seuls les 10 derniers backups sont conservés (les anciens sont supprimés)
- **Arrêt** : Les backups s'arrêtent gracieusement lors de l'arrêt du bot

## Commandes du Bot

### Via Prefix Command

```
&backup
```

Ouvre un panneau interactif avec les boutons :
- **Now** : Créer un backup manuel immédiatement
- **Del** : Supprimer un backup spécifique (sélection par menu)
- **Clear** : Supprimer tous les backups (avec confirmation)

Le panneau affiche également les statistiques et la liste des backups disponibles.

## Script de Restauration CLI

### Afficher l'aide

```bash
node restoreBackup.js help
```

### Lister les backups disponibles

```bash
node restoreBackup.js list
```

### Afficher les statistiques

```bash
node restoreBackup.js stats
```

### Mode restauration interactif

```bash
node restoreBackup.js restore
```

Le script vous demandera de sélectionner un backup à restaurer.

### Restaurer un backup spécifique

```bash
node restoreBackup.js restore backup-2025-05-16T14-30-45-123Z.sqlite.gz
```

## Fonctionnalités de sécurité

### Avant restauration
- Un backup de votre base de données **actuelle** est créé automatiquement
- Ce backup de sécurité est nommé `pre-restore-[timestamp].sqlite.gz`
- Vous pouvez donc revenir en arrière si nécessaire

### Compression
- Les backups sont compressés avec gzip
- Réduit la taille d'environ 90% pour les bases SQLite
- Exemple : 5MB → 500KB

## Structure des fichiers

```
data/
├── sanctions.sqlite          # Base de données principale
├── sanctions.sqlite-shm      # Fichiers WAL (journal)
├── sanctions.sqlite-wal      # Fichiers WAL (journal)
└── backups/
    ├── backup-2025-05-16T14-30-45-123Z.sqlite.gz
    ├── backup-2025-05-16T13-30-45-123Z.sqlite.gz
    └── backup-2025-05-16T12-30-45-123Z.sqlite.gz
```

## Gestion des backups

### Exemple : Utiliser le panneau interactif

**Via le bot :**
```
User: &backup
Bot:  [Panneau interactif avec statistiques et boutons]
     ✓ Backups activés: Oui
     ✓ Intervalle: 60min
     ✓ Nombre de backups: 8/10
     ✓ Taille totale: 4.25MB
     ✓ Dernier backup: 16/05/2025 14:30:45
     
     [Boutons: Now | Del | Clear]
```

**Via le terminal :**
```bash
$ node restoreBackup.js stats

 Statistiques de backup:

   ✓ Backups activés: Oui
   ✓ Intervalle: 60min
   ✓ Nombre de backups: 8/10
   ✓ Taille totale: 4.25MB
   ✓ Dernier backup: 16/05/2025 14:30:45
```

## Bonnes pratiques

1. **Vérifiez régulièrement** que les backups se créent bien
   - Utilisez `&backup` une fois par semaine

2. **Testez vos restaurations** sur une copie/serveur de test
   - Ne restaurez jamais sans vérifier le backup d'abord

3. **Conservez une copie externe** pour les données critiques
   - Les backups locaux peuvent être perdus avec le serveur

4. **Monitorer l'espace disque**
   - 10 backups de 500KB = 5MB
   - Ajustez `maxBackups` si nécessaire

## Dépannage

### Les backups ne se créent pas

1. Vérifiez que `backupEnabled: true` dans `config.js`
2. Vérifiez les permissions du dossier `./data/`
3. Regardez les logs : `[BACKUP] ✓ Backup créé...`

### Le panneau &backup ne s'ouvre pas

1. Vérifiez que vous avez les permissions owner ou admin
2. Vérifiez que les commandes prefix sont activées (`enablePrefixCommands: true`)
3. Vérifiez que le bot a les permissions nécessaires sur le serveur

### Erreur : "Backup introuvable"

```bash
node restoreBackup.js list  # Lister les noms exacts des fichiers
```

### Restauration échouée

1. Le bot va créer un `pre-restore-[timestamp].sqlite.gz` avant de restaurer
2. Si la restauration échoue, vous pouvez restaurer ce fichier temporaire
3. Arrêtez le bot avant toute restauration manuelle

## Architecture interne

### BackupService (src/services/backupService.js)

```javascript
// Démarrer le scheduler automatique
backupService.startScheduler();

// Créer un backup manuel
await backupService.performBackup();

// Restaurer depuis un backup
await backupService.restoreFromBackup('backup-xxx.sqlite.gz');

// Lister les backups
const backups = backupService.listBackups();

// Obtenir les statistiques
const stats = backupService.getStats();

// Supprimer un backup à un index spécifique
backupService.deleteBackupAtIndex(index);

// Supprimer tous les backups
backupService.clearAllBackups();
```

### Commande Backup (src/commands/owner/backup.js)

La commande `&backup` utilise un panneau interactif avec des boutons pour gérer les backups directement depuis Discord. Les interactions sont gérées via `handleBackupInteraction`.

## Limitations connues

- Les backups sont compressés et ne peuvent être restaurés qu'avec ce script
- La décompression se fait en mémoire (problématique pour très grosses bases > 100MB)
- Les backups ne sont pas chiffrés (à implémenter pour la production)

## Améliorations futures

- [ ] Chiffrement des backups
- [ ] Téléchargement des backups vers le cloud (S3, GDrive)
- [ ] Restauration point-in-time
- [ ] Alertes en cas de backup échoué
- [ ] Interface web de gestion des backups
