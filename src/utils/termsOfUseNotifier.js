const { EmbedBuilder } = require('discord.js');
const fs = require('fs');
const path = require('path');

const TERMS_GUILD_ID = '1505673476072149072';
const TERMS_CHANNEL_ID = '1505674134674210827';
const PRIVACY_CHANNEL_ID = '1505675325185589359';

const buildTermsOfUseEmbed = () => {
  const termsPath = path.join(__dirname, '../../docs/TERMS_OF_USE.md');
  let termsContent = '';
  
  try {
    termsContent = fs.readFileSync(termsPath, 'utf-8');
  } catch (error) {
    console.error('terms error:', error);
    termsContent = 'Conditions d\'utilisation non disponibles.';
  }

  const embed = new EmbedBuilder()
    .setTitle('📜 Conditions d\'Utilisation du Bot')
    .setDescription(termsContent.substring(0, 4000))
    .setColor('#050d5f')
    .setFooter({ text: 'powered by mysoulislost' })
    .setTimestamp();

  return embed;
};

const buildPrivacyPolicyEmbed = () => {
  const privacyPath = path.join(__dirname, '../../docs/PRIVACY_POLICY.md');
  let privacyContent = '';
  
  try {
    privacyContent = fs.readFileSync(privacyPath, 'utf-8');
  } catch (error) {
    console.error('privacy error:', error);
    privacyContent = 'Politique de confidentialité non disponible.';
  }

  const embed = new EmbedBuilder()
    .setTitle('🔒 Politique de Confidentialité du Bot')
    .setDescription(privacyContent.substring(0, 4000))
    .setColor('#050d5f')
    .setFooter({ text: 'powered by mysoulislost' })
    .setTimestamp();

  return embed;
};

const updateOrSendEmbed = async (channel, embed, title) => {
  try {
    const messages = await channel.messages.fetch({ limit: 10 });
    const existingMessage = messages.find(m => 
      m.embeds.length > 0 && 
      m.embeds[0].title === title &&
      m.author.id === channel.client.user.id
    );

    if (existingMessage) {
      await existingMessage.edit({ embeds: [embed] });
      console.log(`terms updated ${channel.name}`);
    } else {
      await channel.send({ embeds: [embed] });
      console.log(`terms sent ${channel.name}`);
    }
    return true;
  } catch (error) {
    console.error(`terms error:`, error);
    return false;
  }
};

const sendTermsOfUseNotification = async (client) => {
  try {
    const guild = await client.guilds.fetch(TERMS_GUILD_ID).catch(() => null);
    if (!guild) {
      console.warn('terms server not found');
      return false;
    }

    const channel = await guild.channels.fetch(TERMS_CHANNEL_ID).catch(() => null);
    if (!channel) {
      console.warn('terms channel not found');
      return false;
    }

    if (!channel.isTextBased()) {
      console.warn('terms channel not text');
      return false;
    }

    const embed = buildTermsOfUseEmbed();
    return await updateOrSendEmbed(channel, embed, '📜 Conditions d\'Utilisation du Bot');
  } catch (error) {
    console.error('terms error:', error);
    return false;
  }
};

const sendPrivacyPolicyNotification = async (client) => {
  try {
    const guild = await client.guilds.fetch(TERMS_GUILD_ID).catch(() => null);
    if (!guild) {
      console.warn('privacy server not found');
      return false;
    }

    const channel = await guild.channels.fetch(PRIVACY_CHANNEL_ID).catch(() => null);
    if (!channel) {
      console.warn('privacy channel not found');
      return false;
    }

    if (!channel.isTextBased()) {
      console.warn('privacy channel not text');
      return false;
    }

    const embed = buildPrivacyPolicyEmbed();
    return await updateOrSendEmbed(channel, embed, '🔒 Politique de Confidentialité du Bot');
  } catch (error) {
    console.error('privacy error:', error);
    return false;
  }
};

const sendAllNotifications = async (client) => {
  await sendTermsOfUseNotification(client);
  await sendPrivacyPolicyNotification(client);
};

module.exports = {
  buildTermsOfUseEmbed,
  buildPrivacyPolicyEmbed,
  sendTermsOfUseNotification,
  sendPrivacyPolicyNotification,
  sendAllNotifications,
  TERMS_GUILD_ID,
  TERMS_CHANNEL_ID,
  PRIVACY_CHANNEL_ID
};
