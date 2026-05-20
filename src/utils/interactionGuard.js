const { MessageFlags } = require('discord.js');

const EXECUTOR_CUSTOM_ID_PATTERN = /^(?:tempmute|warn)_(?:category|duration|motif)_\d+_(\d+)/;

const getExecutorIdFromCustomId = (customId) => {
  if (!customId) {
    return null;
  }
  const match = customId.match(EXECUTOR_CUSTOM_ID_PATTERN);
  return match?.[1] ?? null;
};

const getMessageInvokerId = (interaction) => {
  const fromCustomId = getExecutorIdFromCustomId(interaction.customId);
  if (fromCustomId) {
    return fromCustomId;
  }

  const message = interaction.message;
  if (!message) {
    return null;
  }

  return message.interactionMetadata?.user?.id ?? message.interaction?.user?.id ?? null;
};

const assertMessageInvoker = async (interaction) => {
  const invokerId = getMessageInvokerId(interaction);
  if (!invokerId || interaction.user.id === invokerId) {
    return true;
  }

  const payload = {
    content: 'Seul l’utilisateur qui a exécuté cette commande peut interagir avec ce message.',
    flags: MessageFlags.Ephemeral
  };

  if (interaction.replied || interaction.deferred) {
    await interaction.followUp(payload).catch(() => {});
  } else {
    await interaction.reply(payload).catch(() => {});
  }
  return false;
};

const isComponentInteraction = (interaction) =>
  interaction.isButton()
  || interaction.isStringSelectMenu()
  || interaction.isRoleSelectMenu()
  || interaction.isUserSelectMenu()
  || interaction.isChannelSelectMenu()
  || interaction.isMentionableSelectMenu()
  || interaction.isModalSubmit();

module.exports = {
  assertMessageInvoker,
  getMessageInvokerId,
  isComponentInteraction
};
