# Plan d'implémentation

1. **Infrastructure de base**
   - Initialiser un projet Node.js, préparer `config.js` et la structure `src/`.
   - Mettre en place une base SQLite via `better-sqlite3` avec tables propriétaires, sanctions, événements et permissions.

2. **Services métiers**
   - `ConfigService` pour fusionner configuration fichier et overrides en base.
   - `PermissionService` pour gérer owners, rôles autorisés et vérifications d'action.
   - `CooldownService` pour appliquer cooldowns et limites quotidiennes.
   - `SanctionService` pour appliquer/revoquer les sanctions, gérer la blacklist et les expirations automatiques.

3. **Gestion des commandes**
   - Créer un `CommandRegistry` capable de gérer slash commandes (sanctions directes `/ban`, `/kick`, etc., ainsi que `/owner`, `/botconfig`) et commandes préfixées.
   - Uniformiser les contrôles (permissions, raisons, cooldowns) et la génération d'embeds.

4. **Démarrage du bot**
   - Initialiser le client Discord avec les intents nécessaires.
   - Synchroniser les slash commandes lorsque l'option est activée.
   - Lancer un scheduler pour les sanctions temporaires.

5. **Documentation & scripts**
   - Fournir un script `register:slash` pour resynchroniser les commandes.
   - Documenter l'installation, la configuration et l'usage dans `README.md`.
