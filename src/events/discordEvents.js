const { Events } = require('discord.js');
const { handleGuildMemberAdd } = require('./guildMemberAdd');
const { sendAllNotifications } = require('../utils/termsOfUseNotifier');
const { SANCTION_CHECK_INTERVAL } = require('../constants');

const setupDiscordEvents = (client, db, sanctionService, configService, commandRegistry, backupService, setSchedulerHandle) => {
  
  client.on(Events.GuildMemberAdd, async (member) => {
    try {
      await handleGuildMemberAdd(member, sanctionService, db);
    } catch (error) {
      console.error('member add error:', error);
    }
  });

  client.on(Events.GuildBanAdd, async (ban) => {
    try {
      const guild = ban.guild;
      const targetUser = ban.user;

      let banReason = 'Raison non spécifiée';
      try {
        const banFetch = await guild.bans.fetch(targetUser.id);
        if (banFetch && banFetch.reason) {
          banReason = banFetch.reason;
        }
      } catch (error) {
        console.error('ban reason error:', error);
      }

      const existingBan = db.findActiveSanction(guild.id, targetUser.id, ['BAN', 'TEMPBAN']);
      if (existingBan) {
        if (!existingBan.metadata) {
          db.db.prepare('UPDATE sanctions SET metadata = ? WHERE id = ?').run(JSON.stringify({ source: 'context_menu' }), existingBan.id);
        }
        return;
      }

      db.recordSanction({
        guildId: guild.id,
        type: 'BAN',
        targetId: targetUser.id,
        targetTag: targetUser.tag,
        executorId: guild.ownerId || 'SYSTEM',
        executorTag: 'System',
        reason: banReason,
        createdAt: Date.now(),
        metadata: JSON.stringify({ source: 'context_menu' })
      });

      console.log(`ban ${targetUser.id}`);
    } catch (error) {
      console.error('ban add error:', error);
    }
  });

  client.on(Events.MessageCreate, async (message) => {
    try {
      await commandRegistry.handleMessage(message);
    } catch (error) {
      console.error('command error:', error);
    }
  });

  client.on(Events.ClientReady, async () => {
    console.log(`ready ${client.user.tag}`);

    try {
      await commandRegistry.registerSlashCommands();
      console.log('commands registered');
    } catch (error) {
      console.error('commands error:', error);
    }

    const processExpirations = async (label = 'planifié') => {
      try {
        const stats = await sanctionService.processExpiredSanctions();
        if (stats.due > 0 || label === 'démarrage') {
          console.log(`sanctions ${stats.processed} ${stats.failed} ${stats.skipped} ${stats.due}`);
        }
      } catch (error) {
        console.error('sanctions error:', error);
      }
    };

    const processPunishmentExpirations = async (label = 'planifié') => {
      try {
        const expiredPunishments = db.getExpiredPunishments();
        if (expiredPunishments.length > 0 || label === 'démarrage') {
          for (const punishment of expiredPunishments) {
            db.removePunishment(punishment.userId);
          }
          console.log(`punishments ${expiredPunishments.length}`);
        }
      } catch (error) {
        console.error('punishments error:', error);
      }
    };

    await processExpirations('démarrage');
    await processPunishmentExpirations('démarrage');
    const schedulerHandle = setInterval(() => {
      processExpirations('planifié');
      processPunishmentExpirations('planifié');
    }, SANCTION_CHECK_INTERVAL);
    
    if (typeof setSchedulerHandle === 'function') {
      setSchedulerHandle(schedulerHandle);
    }

    backupService.startScheduler();

    await sendAllNotifications(client);
  });
};

module.exports = { setupDiscordEvents };
