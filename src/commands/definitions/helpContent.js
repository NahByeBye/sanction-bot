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
      slash: '/ban membre:@utilisateur raison:<raison> [duree]',
      prefix: '&ban @utilisateur [durée] <raison>'
    },
    examples: {
      slash: '/ban membre:@Toto raison:"Spam massif" duree:7d',
      prefix: '&ban @Toto 7d Spam massif'
    },
    notes: [
      'Durée optionnelle: laissez vide pour un ban permanent.',
      'Le membre doit être bannissable et la raison est obligatoire.'
    ]
  },
  kick: {
    key: 'kick',
    label: 'Kick',
    category: 'sanctions',
    description: 'Expulse un membre du serveur et consigne l\'action.',
    usage: {
      slash: '/kick membre:@utilisateur raison:<raison>',
      prefix: '&kick @utilisateur <raison>'
    },
    examples: {
      slash: '/kick membre:@Leia raison:"Provocations"',
      prefix: '&kick @Leia Provocations répétées'
    },
    notes: [
      'Le membre doit encore être présent sur le serveur et être expulsable.',
      'La raison est obligatoire si l\'option enforceReason est active.'
    ]
  },
  tempban: {
    key: 'tempban',
    label: 'TempBan',
    category: 'sanctions',
    description: 'Bannit un membre pour une durée définie (requis).',
    usage: {
      slash: '/tempban membre:@utilisateur raison:<raison> duree:<durée>',
      prefix: '&tempban @utilisateur <durée> <raison>'
    },
    examples: {
      slash: '/tempban membre:@Lina raison:"DM publicité" duree:24h',
      prefix: '&tempban @Lina 24h DM pub'
    },
    notes: [
      'Durée obligatoire: formats supportés 30m, 12h, 7d, etc.',
      'Refuse de s\'exécuter si une sanction de ban est déjà active.'
    ]
  },
  unban: {
    key: 'unban',
    label: 'Unban',
    category: 'revocations',
    description: 'Lève un ban actif et journalise la levée.',
    usage: {
      slash: '/unban membre:@utilisateur raison:<raison>',
      prefix: '&unban @utilisateur <raison>'
    },
    examples: {
      slash: '/unban membre:@Kira raison:"Erreure"',
      prefix: '&unban @Kira erreur de cible'
    },
    notes: [
      'Nécessite qu\'un ban actif existe dans la base de données.',
      'Enregistre un événement de levée lié à la sanction initiale.'
    ]
  },
  warn: {
    key: 'warn',
    label: 'Warn',
    category: 'sanctions',
    description: 'Ajoute un avertissement dans l\'historique d\'un membre.',
    usage: {
      slash: '/warn membre:@utilisateur raison:<raison>',
      prefix: '&warn @utilisateur <raison>'
    },
    examples: {
      slash: '/warn membre:@Jay raison:"Langage inapproprié"',
      prefix: '&warn @Jay Langage inapproprié'
    },
    notes: ['Pas de durée: le warn est purement informatif.']
  },
  mute: {
    key: 'mute',
    label: 'Mute',
    category: 'sanctions',
    description: 'Applique un timeout (conversation muette). Durée optionnelle.',
    usage: {
      slash: '/mute membre:@utilisateur raison:<raison> [duree]',
      prefix: '&mute @utilisateur [durée] <raison>'
    },
    examples: {
      slash: '/mute membre:@Noé raison:"Spam" duree:30m',
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
    description: 'Mute temporaire: la durée est obligatoire.',
    usage: {
      slash: '/tempmute membre:@utilisateur raison:<raison> duree:<durée>',
      prefix: '&tempmute @utilisateur <durée> <raison>'
    },
    examples: {
      slash: '/tempmute membre:@Noa raison:"Spam vocal" duree:2h',
      prefix: '&tempmute @Noa 2h Spam vocal'
    },
    notes: ['Refuse la commande si aucune durée valide n\'est fournie.']
  },
  unmute: {
    key: 'unmute',
    label: 'Unmute',
    category: 'revocations',
    description: 'Retire le timeout actif d\'un membre.',
    usage: {
      slash: '/unmute membre:@utilisateur raison:<raison>',
      prefix: '&unmute @utilisateur <raison>'
    },
    examples: {
      slash: '/unmute membre:@Mina raison:"Sanction terminée"',
      prefix: '&unmute @Mina fin de sanction'
    },
    notes: ['Vérifie qu\'un mute actif existe avant de lever la sanction.']
  },
  blacklist: {
    key: 'blacklist',
    label: 'Blacklist',
    category: 'sanctions',
    description: 'Empêche un membre d\'utiliser le bot (sans durée).',
    usage: {
      slash: '/blacklist membre:@utilisateur raison:<raison>',
      prefix: '&blacklist @utilisateur <raison>'
    },
    examples: {
      slash: '/blacklist membre:@Spammer raison:"Abuse des commandes"',
      prefix: '&blacklist @Spammer Abuse commandes'
    },
    notes: ['Le membre blacklisté ne peut plus exécuter de commandes (hors /owner).']
  },
  tempblacklist: {
    key: 'tempblacklist',
    label: 'TempBlacklist',
    category: 'sanctions',
    description: 'Blacklist temporaire: durée obligatoire.',
    usage: {
      slash: '/tempblacklist membre:@utilisateur raison:<raison> duree:<durée>',
      prefix: '&tempblacklist @utilisateur <durée> <raison>'
    },
    examples: {
      slash: '/tempblacklist membre:@BotAbuser raison:"Spam" duree:12h',
      prefix: '&tempblacklist @BotAbuser 12h Spam commandes'
    },
    notes: ['Au terme de la durée, la blacklist est levée automatiquement.']
  },
  unblacklist: {
    key: 'unblacklist',
    label: 'Unblacklist',
    category: 'revocations',
    description: 'Retire une blacklist active.',
    usage: {
      slash: '/unblacklist membre:@utilisateur raison:<raison>',
      prefix: '&unblacklist @utilisateur <raison>'
    },
    examples: {
      slash: '/unblacklist membre:@Zoé raison:"Pardon"',
      prefix: '&unblacklist @Zoé comportement corrigé'
    },
    notes: ['Met à jour le cache pour autoriser de nouveau les commandes.']
  },
  listsanctions: {
    key: 'listsanctions',
    label: 'Liste des sanctions',
    category: 'history',
    description: 'Affiche les sanctions enregistrées pour un membre.',
    usage: {
      slash: '/listsanctions membre:@utilisateur [type]',
      prefix: '&listsanctions @utilisateur [type]'
    },
    examples: {
      slash: '/listsanctions membre:@Eli type:ban',
      prefix: '&listsanctions @Eli ban'
    },
    notes: ['Affiche jusqu\'à 10 entrées, filtrables par type.']
  },
  ownerAdd: {
    key: 'ownerAdd',
    label: 'Owner ajouter',
    category: 'owners',
    description: 'Ajoute un owner secondaire au bot.',
    usage: {
      slash: '/owner ajouter membre:@utilisateur',
      prefix: '&owner ajouter @utilisateur'
    },
    examples: {
      slash: '/owner ajouter membre:@Staff',
      prefix: '&owner ajouter @Staff'
    },
    notes: ['Seuls les owners existants ou administrateurs Discord peuvent utiliser cette commande.']
  },
  ownerRemove: {
    key: 'ownerRemove',
    label: 'Owner retirer',
    category: 'owners',
    description: 'Retire un owner secondaire.',
    usage: {
      slash: '/owner retirer membre:@utilisateur',
      prefix: '&owner retirer @utilisateur'
    },
    examples: {
      slash: '/owner retirer membre:@Staff',
      prefix: '&owner retirer @Staff'
    },
    notes: ['Impossible de retirer l\'owner principal défini dans la configuration.']
  },
  ownerList: {
    key: 'ownerList',
    label: 'Owner liste',
    category: 'owners',
    description: 'Liste tous les owners connus.',
    usage: {
      slash: '/owner liste',
      prefix: '&owner liste'
    },
    examples: {
      slash: '/owner liste',
      prefix: '&owner liste'
    },
    notes: ['Affiche un embed récapitulant les owners primaires et secondaires.']
  },
  configToggle: {
    key: 'configToggle',
    label: 'Config toggle',
    category: 'config',
    description: 'Active ou désactive une option majeure du bot.',
    usage: {
      slash: '/botconfig toggle fonction:<option> valeur:<bool>',
      prefix: '&config toggle <option> <on|off>'
    },
    examples: {
      slash: '/botconfig toggle fonction:enableSlashCommands valeur:true',
      prefix: '&config toggle enablePrefixCommands on'
    },
    notes: ['Options disponibles: enableSlashCommands, enablePrefixCommands, enforceReason.']
  },
  configRoles: {
    key: 'configRoles',
    label: 'Config rôles',
    category: 'config',
    description: 'Définit les rôles autorisés pour une action modération.',
    usage: {
      slash: '/botconfig roles action:<action> mode:<set|clear> [role1..role5]',
      prefix: '&config roles <action> <@role...>'
    },
    examples: {
      slash: '/botconfig roles action:sanction:ban mode:set role1:@Mod role2:@Admin',
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
      slash: '/botconfig cooldown action:<action> secondes:<valeur>',
      prefix: '&config cooldown <action> <secondes>'
    },
    examples: {
      slash: '/botconfig cooldown action:sanction:ban secondes:60',
      prefix: '&config cooldown sanction:ban 60'
    },
    notes: ['Mettez 0 pour désactiver le cooldown.']
  },
  configLimit: {
    key: 'configLimit',
    label: 'Config limite',
    category: 'config',
    description: 'Fixe une limite quotidienne pour une action.',
    usage: {
      slash: '/botconfig limit action:<action> valeur:<limite>',
      prefix: '&config limit <action> <valeur>'
    },
    examples: {
      slash: '/botconfig limit action:sanction:warn valeur:10',
      prefix: '&config limit sanction:warn 10'
    },
    notes: ['Utilisez 0 ou "reset" pour retirer la limite.']
  },
  help: {
    key: 'help',
    label: 'Help',
    category: 'assistance',
    description: 'Affiche ce menu interactif d\'aide.',
    usage: {
      slash: '/help',
      prefix: '&help'
    },
    examples: {
      slash: '/help',
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
