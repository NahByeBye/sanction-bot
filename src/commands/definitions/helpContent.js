const helpCategories = {
  sanctions: {
    id: 'sanctions',
    label: 'Sanctions',
    description: 'Appliquer des sanctions immédiates (ban, kick, mute, warn, blacklist, etc.).'
  },
  revocations: {
    id: 'revocations',
    label: 'Levées de sanction',
    description: 'Lever ou annuler une sanction active.'
  },
  history: {
    id: 'history',
    label: 'Historique',
    description: 'Consulter les sanctions enregistrées et leurs détails.'
  },
  owners: {
    id: 'owners',
    label: 'Owners',
    description: 'Gérer la liste des owners autorisés à administrer le bot.'
  },
  config: {
    id: 'config',
    label: 'Configuration',
    description: 'Adapter les paramètres du bot (rôles, limites, toggles, etc.).'
  },
  assistance: {
    id: 'assistance',
    label: 'Assistance',
    description: 'Commandes utilitaires et informations sur le bot.'
  }
};

const helpEntries = {
  ban: {
    key: 'ban',
    label: 'Ban',
    category: 'sanctions',
    description: 'Bannit un membre définitivement ou pour une durée optionnelle.',
    usage: {
      prefix: '&ban @utilisateur [durée] <raison>'
    },
    examples: {
      prefix: '&ban @Toto 24h Spam massif'
    },
    notes: [
      'Sans durée = ban permanent. Avec durée = unban automatique à l\'expiration.',
      'Formats durée : 60s (secondes), 30m (minutes), 24h (heures), 7j (jours).'
    ]
  },
  kick: {
    key: 'kick',
    label: 'Kick',
    category: 'sanctions',
    description: 'Expulse un membre du serveur et consigne l\'action.',
    usage: {
      prefix: '&kick @utilisateur <raison>'
    },
    examples: {
      prefix: '&kick @Leia Provocations répétées'
    },
    notes: [
      'Le membre doit encore être présent sur le serveur et être expulsable.',
      'La raison est obligatoire si l\'option enforceReason est active.'
    ]
  },
  unban: {
    key: 'unban',
    label: 'Unban',
    category: 'revocations',
    description: 'Lève un ban actif et journalise la levée.',
    usage: {
      prefix: '&unban @utilisateur'
    },
    examples: {
      prefix: '&unban @Kira'
    },
    notes: [
      'Aucune raison requise ni affichée.',
      'Débannit sur Discord. Si la personne est blacklistée, elle reste en BL et sera re-bannie à la prochaine arrivée.',
      'Seul /unblacklist retire une blacklist.'
    ]
  },
  warn: {
    key: 'warn',
    label: 'Warn',
    category: 'sanctions',
    description: 'Ajoute un avertissement via le même menu interactif que tempmute.',
    usage: {
      prefix: '&warn @utilisateur'
    },
    examples: {
      prefix: '-warn @Jay'
    },
    notes: ['Catégorie → motif : la sanction est appliquée immédiatement, sans saisie supplémentaire.']
  },
  mute: {
    key: 'mute',
    label: 'Mute',
    category: 'sanctions',
    description: 'Applique un timeout (conversation muette). Durée optionnelle.',
    usage: {
      prefix: '&mute @utilisateur [durée] <raison>'
    },
    examples: {
      prefix: '&mute @Noé 30m Spam emoji'
    },
    notes: [
      'Sans durée, applique la durée maximale autorisée par Discord (28 jours).'
    ]
  },
  tempmute: {
    key: 'tempmute',
    label: 'TempMute',
    category: 'sanctions',
    description: 'Mute temporaire via menu catégorie puis durée (rôle Mute).',
    usage: {
      prefix: '&tempmute @utilisateur'
    },
    examples: {
      prefix: '&tempmute @Noa'
    },
    notes: ['Catégorie → durée : la sanction est appliquée immédiatement, sans saisie supplémentaire.', 'Utilise le rôle Mute, pas le timeout Discord.']
  },
  unmute: {
    key: 'unmute',
    label: 'Unmute',
    category: 'revocations',
    description: 'Retire le mute d\'un membre.',
    usage: {
      prefix: '&unmute @utilisateur'
    },
    examples: {
      prefix: '&unmute @Mina'
    },
    notes: [
      'Aucune raison requise ni affichée.',
      'Vérifie qu\'un mute actif existe avant de lever la sanction.',
      'N\'enlève pas les timeouts, utilise &unto pour ça.'
    ]
  },
  unto: {
    key: 'unto',
    label: 'Unto',
    category: 'revocations',
    description: 'Retire le timeout d\'un membre.',
    usage: {
      prefix: '&unto @utilisateur'
    },
    examples: {
      prefix: '&unto @Mina'
    },
    notes: [
      'Aucune raison requise ni affichée.',
      'Vérifie qu\'un timeout actif existe avant de lever la sanction.',
      'N\'enlève pas les mutes (rôle), utilise &unmute pour ça.'
    ]
  },
  blacklist: {
    key: 'blacklist',
    label: 'Blacklist',
    category: 'sanctions',
    description: 'Sanction maximale : ban permanent du serveur, plus fort qu\'un ban classique.',
    usage: {
      prefix: '&bl — liste paginée\n&bl <id|@user> [durée] <raison>'
    },
    examples: {
      prefix: '&bl\n&bl @Joe Récidive grave'
    },
    notes: [
      'Sans argument : affiche la liste des blacklistés (10 par page, boutons << >>).',
      'Sans durée = blacklist permanente. Avec durée = levée auto à l\'expiration.',
      'Si un Owner bot blackliste quelqu\'un, seul un Owner peut le unblacklist.',
      'Répondre à un message avec &bl ouvre la liste (ne cible pas l\'auteur).',
      'Formats durée : 60s, 30m, 24h, 7j.'
    ]
  },
  unblacklist: {
    key: 'unblacklist',
    label: 'Unblacklist',
    category: 'revocations',
    description: 'Retire une blacklist serveur et débannit l\'utilisateur.',
    usage: {
      prefix: '&unbl @utilisateur'
    },
    examples: {
      prefix: '&unbl @Zoé'
    },
    notes: [
      'Aucune raison requise ni affichée.',
      'Seule commande capable de lever une blacklist. Débannit du serveur.',
      'Si la blacklist a été posée par un Owner bot, seul un Owner peut la lever.'
    ]
  },
  listsanctions: {
    key: 'listsanctions',
    label: 'Liste des sanctions',
    category: 'history',
    description: 'Affiche les sanctions enregistrées pour un membre.',
    usage: {
      prefix: '&listsanctions @utilisateur [type]'
    },
    examples: {
      prefix: '&listsanctions @Eli ban'
    },
    notes: [
      'Les Sanction ID (#1, #2, …) sont propres à chaque membre (pas globales au serveur).',
      'Affiche l\'historique complet (actives et révoquées), filtrable par type.'
    ]
  },
  owner: {
    key: 'owner',
    label: 'Owner',
    category: 'owners',
    description: 'Liste les owners ou bascule le statut owner d’un utilisateur.',
    usage: {
      prefix: '&owner [id|@utilisateur]'
    },
    examples: {
      prefix: '&owner @Staff'
    },
    notes: ['Sans argument : liste.', 'Avec ID : ajoute ou retire (toggle).']
  },
  backup: {
    key: 'backup',
    label: 'Backup',
    category: 'owners',
    description: 'Panneau interactif des sauvegardes.',
    usage: {
      prefix: '&backup'
    },
    examples: {
      prefix: '&backup'
    },
    notes: ['Boutons Now, Del (par numéro) et Clear (avec confirmation).']
  },
  configToggle: {
    key: 'configToggle',
    label: 'Config toggle',
    category: 'config',
    description: 'Active ou désactive une option majeure du bot.',
    usage: {
      prefix: '&config toggle <option> <on|off>'
    },
    examples: {
      prefix: '&config toggle enforceReason on'
    },
    notes: ['Configurez via le panneau /botconfig.']
  },
  configRoles: {
    key: 'configRoles',
    label: 'Config rôles',
    category: 'config',
    description: 'Définit les rôles autorisés pour une action modération.',
    usage: {
      prefix: '&config roles <action> <@role...>'
    },
    examples: {
      prefix: '&config roles sanction:ban @Mod @Admin'
    },
    notes: ['Utilisez le mode "clear" pour retirer tous les rôles configurés.']
  },
  configCooldown: {
    key: 'configCooldown',
    label: 'Config cooldown',
    category: 'config',
    description: 'Ajuste le cooldown d\'une action (en secondes).',
    usage: {
      prefix: '&config cooldown <action> <secondes>'
    },
    examples: {
      prefix: '&config cooldown sanction:ban 60'
    },
    notes: ['Mettez 0 pour désactiver le cooldown.']
  },
  configLimit: {
    key: 'configLimit',
    label: 'Config limite',
    category: 'config',
    description: 'Fixe une limite d’utilisation pour une action, avec fenêtre personnalisable.',
    usage: {
      prefix: '&config limit <action> <valeur> [fenetre_en_minutes]'
    },
    examples: {
      prefix: '&config limit sanction:warn 10 20'
    },
    notes: ['Utilisez 0 ou "reset" pour retirer la limite.', 'Fenêtre 0 = 24h par défaut.']
  },
  configBot: {
    key: 'configBot',
    label: 'Config bot',
    category: 'config',
    description: 'Panneau de configuration interactif pour owners et sous-owners.',
    usage: {
      slash: '/botconfig'
    },
    examples: {
      slash: '/botconfig'
    },
    notes: [
      'Commande slash uniquement (pas de préfixe).',
      'Réservée au propriétaire principal et aux owners secondaires du bot.',
      'Permet de configurer le bot avec des menus interactifs simples.'
    ]
  },
  clearsanctions: {
    key: 'clearsanctions',
    label: 'Clear sanctions',
    category: 'sanctions',
    description: 'Révoque toutes les sanctions actives d\'un utilisateur (ban, mute, blacklist, etc.).',
    usage: {
      prefix: '&clear-sanctions @utilisateur raison'
    },
    examples: {
      prefix: '&clear-sanctions @Membre Réhabilitation'
    },
    notes: ['Efface toutes les sanctions actives de l\'utilisateur dans le serveur.', 'La raison est obligatoire.', 'Configurable via /botconfig pour les permissions.', 'Nécessite la permission sanction:clear.']
  },
  help: {
    key: 'help',
    label: 'Help',
    category: 'assistance',
    description: 'Affiche ce menu interactif d\'aide.',
    usage: {
      prefix: '&help'
    },
    examples: {
      prefix: '&help'
    },
    notes: [
      'Utilise un menu déroulant pour naviguer entre les catégories de commandes.',
      'Affiche des exemples concrets pour chaque commande.'
    ]
  }
};

module.exports = {
  helpCategories,
  helpEntries
};
