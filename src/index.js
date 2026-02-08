import { createServer } from 'http';
import bot from './bot.js';
import { config } from './config.js';
import { initStorage, closeStorage, getAllUserIds, getUserData, setUserData } from './storage/index.js';
import { initScheduleChecker, stopScheduleChecker } from './jobs/scheduleChecker.js';
import { initChannelGuard, stopChannelGuard } from './jobs/channelGuard.js';
import { migrateExistingChannel } from './services/channel.js';
import { initPendingChannelsCleanup, stopPendingChannelsCleanup } from './handlers/start.js';

// Track processed update IDs to prevent duplicate processing (LRU-style)
const processedUpdates = new Map();
const MAX_PROCESSED_UPDATES = 1000;

// Track server for graceful shutdown
let httpServer = null;

async function main() {
  console.log('🚀 Starting Voltyk Bot...');
  
  // Initialize storage
  await initStorage();
  
  // Initialize bot (this also fetches bot info internally)
  await bot.init();
  
  // Get bot info from initialized bot
  const botInfo = bot.botInfo;
  console.log(`✅ Bot @${botInfo.username} is ready`);
  
  // Register bot commands
  await registerBotCommands(bot);
  
  // Initialize schedule checker
  initScheduleChecker(bot);
  
  // Initialize channel guard
  initChannelGuard(bot);
  
  // Initialize pending channels cleanup
  initPendingChannelsCleanup();
  
  // Run one-time migration for existing channels
  await migrateExistingChannels(bot);
  
  // Setup webhook
  if (config.webhookDomain) {
    // Remove trailing slash from domain to prevent double slashes
    const domain = config.webhookDomain.replace(/\/+$/, '');
    const webhookUrl = `${domain}/webhook`;
    await bot.api.setWebhook(webhookUrl);
    console.log(`✅ Webhook set to: ${webhookUrl}`);
    
    const server = createServer(async (req, res) => {
      // Health check endpoint
      if (req.url === '/health' || req.url === '/') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: 'ok', bot: botInfo.username }));
        return;
      }
      
      // Webhook endpoint
      if (req.url === '/webhook' && req.method === 'POST') {
        let body = '';
        
        req.on('data', (chunk) => {
          body += chunk.toString();
        });
        
        req.on('end', async () => {
          try {
            const update = JSON.parse(body);
            
            // Check for duplicate updates
            if (processedUpdates.has(update.update_id)) {
              console.log(`⚠️  Duplicate update ${update.update_id}, skipping`);
              res.writeHead(200);
              res.end('ok');
              return;
            }
            
            // Add to processed map (Map maintains insertion order)
            processedUpdates.set(update.update_id, Date.now());
            
            // Limit map size (remove oldest entries)
            if (processedUpdates.size > MAX_PROCESSED_UPDATES) {
              const firstKey = processedUpdates.keys().next().value;
              processedUpdates.delete(firstKey);
            }
            
            // Process update directly through bot
            await bot.handleUpdate(update);
            
            res.writeHead(200);
            res.end('ok');
          } catch (error) {
            console.error('❌ Error processing update:', error);
            res.writeHead(200); // Return 200 to prevent Telegram retries
            res.end('ok');
          }
        });
        
        return;
      }
      
      // 404 for other routes
      res.writeHead(404);
      res.end('Not Found');
    });
    
    const port = config.port;
    httpServer = server.listen(port, () => {
      console.log(`✅ Server listening on port ${port}`);
    });
  } else {
    console.log('⚠️  WEBHOOK_DOMAIN not set, bot will not receive updates');
    console.log('ℹ️  Set WEBHOOK_DOMAIN in .env to enable webhook mode');
  }
}

// Handle graceful shutdown
async function gracefulShutdown(signal) {
  console.log(`\n👋 Received ${signal}, shutting down gracefully...`);
  
  // Stop accepting new requests
  if (httpServer) {
    await new Promise((resolve) => {
      httpServer.close((err) => {
        if (err) {
          console.error('⚠️  Error closing HTTP server:', err.message);
        } else {
          console.log('✅ HTTP server closed');
        }
        resolve(); // Always resolve to continue shutdown
      });
    });
  }
  
  // Stop schedule checker
  stopScheduleChecker();
  
  // Stop channel guard
  stopChannelGuard();
  
  // Stop pending channels cleanup
  stopPendingChannelsCleanup();
  
  // Stop bot
  try {
    await bot.stop();
    console.log('✅ Bot stopped');
  } catch (error) {
    console.error('⚠️  Error stopping bot (shutdown will continue):', error.message);
  }
  
  // Close storage connections
  await closeStorage();
  
  console.log('✅ Shutdown complete');
  process.exit(0);
}

process.once('SIGINT', () => gracefulShutdown('SIGINT'));
process.once('SIGTERM', () => gracefulShutdown('SIGTERM'));

/**
 * Register bot commands
 */
async function registerBotCommands(bot) {
  try {
    await bot.api.setMyCommands([
      { command: 'start', description: '🚀 Запустити бота' },
      { command: 'schedule', description: '📊 Графік відключень' },
      { command: 'next', description: '⏱ Наступне відключення' },
      { command: 'timer', description: '⏱ Таймер до відключення' },
      { command: 'stats', description: '📈 Моя статистика' },
      { command: 'settings', description: '⚙️ Налаштування' },
      { command: 'channel', description: '📺 Керування каналом' },
      { command: 'help', description: '❓ Допомога' },
      { command: 'cancel', description: '🚫 Скасувати дію' },
    ]);
    console.log('✅ Bot commands registered');
  } catch (error) {
    console.error('⚠️  Failed to register bot commands:', error);
  }
}

/**
 * Migrate existing channels (one-time on startup)
 */
async function migrateExistingChannels(bot) {
  try {
    console.log('🔄 Checking for channels that need migration...');
    
    const userIds = await getAllUserIds();
    let migratedCount = 0;
    let notifiedCount = 0;
    
    for (const userId of userIds) {
      try {
        const userData = await getUserData(userId);
        
        // Skip if no channel or already has branding fields
        if (!userData.channelId || userData.channel_title) {
          continue;
        }
        
        const migrationResult = await migrateExistingChannel(bot, userData);
        
        if (migrationResult.alreadyCorrect) {
          // Channel already has correct branding - just update DB
          userData.channel_id = userData.channelId;
          userData.channel_title = migrationResult.currentTitle;
          userData.channel_description = migrationResult.currentDescription;
          userData.channel_photo_file_id = migrationResult.currentPhotoFileId;
          userData.channel_status = 'active';
          userData.channel_branding_updated_at = Date.now();
          
          // Extract user title from full title
          const prefix = 'Вольтик ⚡️ ';
          if (migrationResult.currentTitle.startsWith(prefix)) {
            userData.channel_user_title = migrationResult.currentTitle.substring(prefix.length);
          }
          
          await setUserData(userId, userData);
          migratedCount++;
          
          console.log(`✅ Auto-migrated channel for user ${userId} (already correct)`);
        } else if (migrationResult.needsMigration) {
          // Channel needs manual setup - block it and notify user
          userData.channel_status = 'blocked';
          userData.migration_notified = true;
          await setUserData(userId, userData);
          
          await bot.api.sendMessage(userId, `⚠️ <b>Важливе оновлення</b>

Ми додали нову систему брендування каналів для Вольтика.

Всі підключені канали тепер повинні мати:
• Стандартну назву з префіксом "Вольтик ⚡️"
• Стандартний опис
• Стандартне фото

🔴 Ваш канал тимчасово відключено.

Щоб відновити роботу:
1. Перейдіть в Налаштування → Канал
2. Підключіть канал заново
3. Бот автоматично встановить правильне оформлення`, {
            parse_mode: 'HTML',
          });
          
          notifiedCount++;
          console.log(`📧 Notified user ${userId} about migration needed`);
        }
      } catch (error) {
        console.error(`Error migrating channel for user ${userId}:`, error);
      }
    }
    
    console.log(`✅ Migration complete: ${migratedCount} auto-migrated, ${notifiedCount} notified`);
  } catch (error) {
    console.error('Error during channel migration:', error);
  }
}

// Start the bot
main().catch((error) => {
  console.error('❌ Failed to start bot:', error);
  process.exit(1);
});
