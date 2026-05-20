const { ActionRowBuilder, StringSelectMenuBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

const { buildEmbed } = require('./embedFactory');

const { actionChoices } = require('../commands/config/actionChoices');



const categoryChoices = [

  { label: 'Cooldown', value: 'cooldown' },

  { label: 'Limite', value: 'limit' },

  { label: 'Rôles', value: 'roles' },

  { label: 'Raison', value: 'reason' },

  { label: 'Options générales', value: 'toggle' },

  { label: 'État', value: 'state' },

  { label: 'Limites Whitelist', value: 'whitelist_limits' }

];



const botconfigCategoryLabels = {

  cooldown: 'Cooldown',

  limit: 'Limite',

  roles: 'Rôles',

  reason: 'Raison',

  toggle: 'Options générales',

  state: 'État',

  whitelist_limits: 'Limites Whitelist'

};



const botconfigToggleOptions = [

  { label: 'Raison obligatoire (global)', value: 'enforceReason' }

];



const REASON_GLOBAL_OPTION = '__global__';



const formatDurationDisplay = (seconds) => {

  if (!seconds || seconds <= 0) {

    return '24h';

  }

  if (seconds < 60) {

    return `${seconds}s`;

  }

  if (seconds < 3600) {

    return `${Math.floor(seconds / 60)} min`;

  }

  if (seconds < 86400) {

    return `${Math.floor(seconds / 3600)} h`;

  }

  return `${Math.floor(seconds / 86400)} j`;

};



const encodeActionId = (action) =>

  Buffer.from(action, 'utf8')

    .toString('base64')

    .replace(/=/g, '')

    .replace(/\+/g, '-')

    .replace(/\//g, '_');



const decodeActionId = (encoded) =>

  Buffer.from(encoded.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8');



const buildBotconfigMainEmbed = (configService, notice) => {

  const embed = buildEmbed(configService, {

    title: 'Configuration du bot ',

    description:

      'Panneau de gestion réservé aux owners. Choisissez la catégorie de configuration souhaitée.',

    fields: [

      { name: 'Cooldown', value: 'Ajuster le délai entre deux utilisations.', inline: true },

      { name: 'Limite', value: 'Définir une limite par unité de temps.', inline: true },

      { name: 'Rôles', value: 'Gérer les rôles autorisés.', inline: true },

      { name: 'Raison', value: 'Forcer la raison (global ou par commande) et définir les rôles bypass.', inline: false },

      { name: 'Options', value: 'Comportements globaux du bot.', inline: true }

    ]

  });



  if (notice) {

    embed.addFields({ name: '───────────────────────────────────', value: `• ${notice}`, inline: false });

  }



  embed.setFooter({ text: 'Sélectionnez une catégorie en dessous pour continuer' });

  return embed;

};



const buildBotconfigMainComponents = () => {

  const categoryMenu = new StringSelectMenuBuilder()

    .setCustomId('botconfig_category')

    .setPlaceholder('Sélectionnez une catégorie')

    .addOptions(categoryChoices);

  return [new ActionRowBuilder().addComponents(categoryMenu)];

};



const buildBotconfigBackButtonRow = () =>

  new ActionRowBuilder().addComponents(

    new ButtonBuilder()

      .setCustomId('botconfig_back')

      .setLabel('Retour au menu principal')

      .setStyle(ButtonStyle.Secondary)

  );



const buildActionSelectEmbed = (configService, categoryLabel, description) =>

  buildEmbed(configService, {

    title: `Configuration du bot - ${categoryLabel}`,

    description,

    fields: [{ name: 'Étape', value: 'Sélectionnez l’option ci-dessous puis confirmez.', inline: false }]

  });



const buildToggleSelectionEmbed = (configService) =>

  buildEmbed(configService, {

    title: 'Configuration du bot - Options générales',

    description: 'Choisissez une option à activer ou désactiver.',

    fields: [{ name: 'Conseil', value: 'Si nécessaire, ré-appuyez sur Retour pour annuler.', inline: false }]

  });



const buildReasonCategoryEmbed = (configService) =>

  buildEmbed(configService, {

    title: 'Configuration du bot - Raison',

    description:

      'Définissez si la raison est obligatoire (paramètre global ou par commande) et quels rôles peuvent l’ignorer.',

    fields: [

      {

        name: 'Global',

        value: configService.isReasonRequired() ? 'Raison obligatoire pour toutes les commandes (sauf override par commande).' : 'Raison libre par défaut (sauf override par commande).',

        inline: false

      },

      { name: 'Étape suivante', value: 'Choisissez le paramètre global ou une commande ci-dessous.', inline: false }

    ]

  });



const buildReasonGlobalEmbed = (configService) =>

  buildEmbed(configService, {

    title: 'Configuration du bot - Raison (global)',

    description: 'Active ou désactive l’obligation de fournir une raison pour toutes les commandes qui n’ont pas de réglage spécifique.',

    fields: [

      { name: 'État actuel', value: configService.isReasonRequired() ? 'Raison obligatoire' : 'Raison libre', inline: false }

    ]

  });



const buildCommandReasonEmbed = (configService, commandKey) => {

  const bypassRoles = configService.getCommandReasonBypassRoles(commandKey);

  const bypassList = bypassRoles.length ? bypassRoles.map((id) => `<@&${id}>`).join(', ') : 'Aucun rôle';

  const override = configService.getCommandReasonRequirement(commandKey);

  const globalReason = configService.isReasonRequired();

  const stateLabel = override === null

    ? `hérite du global (${globalReason ? 'raison obligatoire' : 'raison libre'})`

    : override

      ? 'raison obligatoire (forcée pour cette commande)'

      : 'raison libre (désactivée pour cette commande)';



  return buildEmbed(configService, {

    title: 'Configuration du bot - Raison obligatoire',

    description: `Définissez si la raison doit être requise pour **${commandKey}**.`,

    fields: [

      { name: 'État actuel', value: stateLabel, inline: false },

      { name: 'Effet réel', value: configService.isReasonRequired(commandKey) ? 'Raison exigée à l’exécution' : 'Raison optionnelle', inline: false },

      { name: 'Rôles bypass', value: bypassList, inline: false },

      { name: 'Remarque', value: 'Les rôles bypass peuvent exécuter la commande sans raison même si elle est obligatoire.', inline: false }

    ]

  });

};



const buildConfirmationEmbed = (configService, description, title = 'Confirmation requise') =>

  buildEmbed(configService, {

    title,

    description,

    fields: [{ name: 'Dernière étape', value: 'Confirmez votre réglage à l’aide du bouton ci-dessous.', inline: false }]

  });



const buildLimitConfigEmbed = (configService, action, currentConfig) => {

  const currentWindow = currentConfig ? currentConfig.limitWindowSeconds : 86400;

  const currentLimit = currentConfig ? currentConfig.dailyLimit : null;

  const limitDisplay = currentLimit ? `${currentLimit} par ${formatDurationDisplay(currentWindow)}` : 'Aucune limite définie';



  return buildEmbed(configService, {

    title: `Configuration de limite — ${action}`,

    description: 'Sélectionnez une unité de temps, puis précisez le nombre et la durée.',

    fields: [

      { name: 'État actuel', value: `• Fenêtre : ${formatDurationDisplay(currentWindow)}\n• Limite : ${limitDisplay}`, inline: false },

      { name: 'Procédure', value: '1. Choisissez Minute / Heure / Jour.\n2. Indiquez le nombre et la durée souhaités.\n3. La configuration sera appliquée sous la forme « 3 par 20 min ».', inline: false }

    ]

  });

};



const buildCooldownConfigEmbed = (configService, action, currentConfig) => {

  const currentCooldown = currentConfig ? currentConfig.cooldownMs : 0;



  return buildEmbed(configService, {

    title: `Configuration de cooldown — ${action}`,

    description: 'Entrez la valeur en secondes pour limiter la fréquence d’utilisation.',

    fields: [

      { name: 'Cooldown actuel', value: `• ${formatDurationDisplay(currentCooldown / 1000)}`, inline: false },

      { name: 'Indication', value: 'Saisissez 0 pour désactiver le cooldown.', inline: false }

    ]

  });

};



const botconfigStateSectionOptions = [

  { label: 'Paramètres globaux', value: 'global', description: 'Raison obligatoire' },

  { label: 'Actions : limites/cooldown/rôles', value: 'actions', description: 'Limites et permissions par action' },

  { label: 'Commandes : raison et bypass', value: 'commands', description: 'Raison obligatoire et rôles bypass par commande' }

];



const chunkStateLines = (lines, chunkSize) => {

  const chunks = [];

  for (let index = 0; index < lines.length; index += chunkSize) {

    chunks.push(lines.slice(index, index + chunkSize).join('\n'));

  }

  return chunks;

};



const buildStateActionLines = (permissionService) =>

  actionChoices.map((choice) => {

    const currentConfig = permissionService.getActionConfig(choice.value);

    const limit = currentConfig.dailyLimit

      ? `${currentConfig.dailyLimit} / ${formatDurationDisplay(currentConfig.limitWindowSeconds)}`

      : 'aucune';

    const cooldown = currentConfig.cooldownMs

      ? formatDurationDisplay(currentConfig.cooldownMs / 1000)

      : 'aucun';

    const roles = Array.isArray(currentConfig.roleIds) && currentConfig.roleIds.length > 0

      ? `${currentConfig.roleIds.length}`

      : '0';

    return `• ${choice.name} : limite ${limit}, cooldown ${cooldown}, rôles ${roles}`;

  });



const buildStateCommandLines = (configService, commandRegistry) =>

  commandRegistry.commandModules

    .filter((module) => module && module.help && module.help.key && module.help.key !== 'configBot')

    .map((module) => {

      const key = module.help.key;

      const label = module.help.label || key;

      const commandReasonOverride = configService.getCommandReasonRequirement(key);

      const globalReason = configService.isReasonRequired();

      const reason = commandReasonOverride === null

        ? `comme le global (${globalReason ? 'raison obligatoire' : 'raison libre'})`

        : commandReasonOverride

          ? 'raison obligatoire'

          : 'raison libre';

      const bypassRoles = configService.getCommandReasonBypassRoles(key);

      const bypass = bypassRoles.length ? `${bypassRoles.length} rôles bypass` : 'aucun rôle bypass';

      return `• ${label} : ${reason}, ${bypass}`;

    });



const buildBotconfigStateMenuEmbed = (configService) =>

  buildEmbed(configService, {

    title: 'État du bot – configuration actuelle',

    description: 'Choisissez une section ci-dessous pour afficher un résumé lisible.',

    fields: [

      { name: 'Sections disponibles', value: 'Paramètres globaux, actions et réglages de raison par commande.', inline: false }

    ]

  });



const buildBotconfigStateSectionEmbed = (configService, permissionService, commandRegistry, section) => {

  if (section === 'global') {

    const toggleStatus = [

      `• Raison obligatoire (global) : ${configService.isReasonRequired() ? 'oui' : 'non'}`

    ].join('\n');



    return buildEmbed(configService, {

      title: 'État – Paramètres globaux',

      description: 'Comportements généraux du bot de sanctions.',

      fields: [{ name: 'Paramètres globaux', value: toggleStatus, inline: false }]

    });

  }



  if (section === 'actions') {

    const actionLines = buildStateActionLines(permissionService);

    const actionFields = chunkStateLines(actionLines, 10).map((lines, index) => ({

      name: index === 0 ? 'Actions : limites/cooldown/rôles' : '​',

      value: lines,

      inline: false

    }));



    return buildEmbed(configService, {

      title: 'État – Actions',

      description: 'Limites, cooldowns et rôles autorisés par action de sanction.',

      fields: actionFields

    });

  }



  const commandLines = buildStateCommandLines(configService, commandRegistry);

  const commandFields = chunkStateLines(commandLines, 8).map((lines, index) => ({

    name: index === 0 ? 'Commandes : raison et bypass' : '​',

    value: lines,

    inline: false

  }));



  return buildEmbed(configService, {

    title: 'État – Commandes',

    description: 'Obligation de raison et rôles bypass par commande.',

    fields: commandFields

  });

};



const buildBotconfigStateSectionComponents = (placeholder = 'Choisissez une section') => {

  const sectionMenu = new StringSelectMenuBuilder()

    .setCustomId('botconfig_state_section')

    .setPlaceholder(placeholder)

    .addOptions(botconfigStateSectionOptions);



  return [

    new ActionRowBuilder().addComponents(sectionMenu),

    buildBotconfigBackButtonRow()

  ];

};



const buildTimeUnitButtons = (customIdPrefix, action) => {

  const encodedAction = encodeActionId(action);

  return [

    new ActionRowBuilder().addComponents(

      new ButtonBuilder()

        .setCustomId(`${customIdPrefix}_unit_60_${encodedAction}`)

        .setLabel('Minute')

        .setStyle(ButtonStyle.Primary),

      new ButtonBuilder()

        .setCustomId(`${customIdPrefix}_unit_3600_${encodedAction}`)

        .setLabel('Heure')

        .setStyle(ButtonStyle.Primary),

      new ButtonBuilder()

        .setCustomId(`${customIdPrefix}_unit_86400_${encodedAction}`)

        .setLabel('Jour')

        .setStyle(ButtonStyle.Primary)

    )

  ];

};



const buildLimitConfigComponents = (customIdPrefix, action) => {

  const encodedAction = encodeActionId(action);

  return [

    ...buildTimeUnitButtons(customIdPrefix, action),

    new ActionRowBuilder().addComponents(

      new ButtonBuilder()

        .setCustomId(`${customIdPrefix}_reset_${encodedAction}`)

        .setLabel('Reset')

        .setStyle(ButtonStyle.Danger)

    )

  ];

};



module.exports = {

  categoryChoices,

  botconfigCategoryLabels,

  botconfigToggleOptions,

  REASON_GLOBAL_OPTION,

  formatDurationDisplay,

  encodeActionId,

  decodeActionId,

  buildBotconfigMainEmbed,

  buildBotconfigMainComponents,

  buildBotconfigBackButtonRow,

  buildActionSelectEmbed,

  buildToggleSelectionEmbed,

  buildReasonCategoryEmbed,

  buildReasonGlobalEmbed,

  buildCommandReasonEmbed,

  buildConfirmationEmbed,

  botconfigStateSectionOptions,

  buildBotconfigStateMenuEmbed,

  buildBotconfigStateSectionEmbed,

  buildBotconfigStateSectionComponents,

  buildLimitConfigEmbed,

  buildCooldownConfigEmbed,

  buildTimeUnitButtons,

  buildLimitConfigComponents

};


