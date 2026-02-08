require('dotenv').config();

const express = require('express');
const { webhookCallback } = require('grammy');
const { autoRetry } = require('@grammyjs/auto-retry');
const { apiThrottler } = require('@grammyjs/transformer-throttler');
const { createBot } = require('./bot');
const { config } = require('./config');
const { getRedisClient, getUserCount, closeRedis } = require('./database/redis');
const { initScheduler, stopScheduler } = require('./scheduler');
const { initChannelGuard, stopChannelGuard } = require('./channelGuard');
const { initPowerMonitor, stopPowerMonitor } = require('./powerMonitor');
const { createLogger } = require('./utils/logger');

const logger = createLogger('Main');

let httpServer = null;
let bot = null;

/**
 * Main function
 */
async function main() {
  logger.info('🚀 Starting Voltyk Bot...');
  
  try {
    // Try to connect to Redis
    const redis = getRedisClient();
    await redis.connect();
    logger.info('✅ Redis connected successfully');
  } catch (error) {
    logger.warn('⚠️  Failed to connect to Redis:', error.message);
    logger.warn('⚠️  Bot will continue with in-memory storage (data will not persist across restarts)');
    // Do not exit - bot will use in-memory fallback
  }
  
  // Create bot with transformers
  bot = createBot();
  
  // Apply auto-retry transformer
  bot.api.config.use(autoRetry({
    maxRetryAttempts: 3,
    maxDelaySeconds: 5,
  }));
  
  // Apply throttler transformer
  const throttler = apiThrottler();
  bot.api.config.use(throttler);
  
  // Initialize bot
  await bot.init();
  const botInfo = bot.botInfo;
  logger.info(`✅ Bot @${botInfo.username} is ready`);
  
  // Register bot commands
  await registerBotCommands(bot);
  
  // Initialize scheduler
  initScheduler(bot);
  
  // Initialize channel guard
  initChannelGuard(bot);
  
  // Initialize power monitor
  initPowerMonitor();
  
  // Setup webhook or polling
  if (config.botMode === 'webhook' && config.webhookUrl) {
    await setupWebhook(bot);
  } else {
    logger.warn('⚠️  Webhook mode not configured, starting in polling mode...');
    await bot.start();
    logger.info('✅ Bot started in polling mode');
  }
}

/**
 * Setup webhook with Express
 */
async function setupWebhook(bot) {
  const app = express();
  app.use(express.json());
  
  // Health check endpoint
  app.get('/', (req, res) => {
    res.send('Voltyk Bot is running');
  });
  
  // Simple in-memory rate limiter for health checks
  const healthCheckLimiter = new Map();
  const HEALTH_CHECK_LIMIT = 10; // Max 10 requests per minute per IP
  const HEALTH_CHECK_WINDOW = 60000; // 1 minute
  
  // Health check with details
  app.get('/health', async (req, res) => {
    try {
      // Basic rate limiting
      const clientIp = req.ip || req.connection.remoteAddress;
      const now = Date.now();
      
      if (!healthCheckLimiter.has(clientIp)) {
        healthCheckLimiter.set(clientIp, { count: 1, resetAt: now + HEALTH_CHECK_WINDOW });
      } else {
        const limiter = healthCheckLimiter.get(clientIp);
        if (now > limiter.resetAt) {
          // Reset window
          limiter.count = 1;
          limiter.resetAt = now + HEALTH_CHECK_WINDOW;
        } else {
          limiter.count++;
          if (limiter.count > HEALTH_CHECK_LIMIT) {
            return res.status(429).json({ status: 'error', error: 'Too many requests' });
          }
        }
      }
      
      // Clean up old entries periodically
      if (healthCheckLimiter.size > 1000) {
        for (const [ip, data] of healthCheckLimiter.entries()) {
          if (now > data.resetAt) {
            healthCheckLimiter.delete(ip);
          }
        }
      }
      
      let redisStatus = 'disconnected';
      try {
        const redis = getRedisClient();
        const redisPing = await redis.ping();
        redisStatus = redisPing === 'PONG' ? 'connected' : 'error';
      } catch (error) {
        redisStatus = 'disconnected';
      }
      
      const userCount = await getUserCount();
      
      res.json({
        status: 'ok',
        uptime: process.uptime(),
        redis: redisStatus,
        users: userCount,
        memory: {
          heapUsed: process.memoryUsage().heapUsed,
          heapTotal: process.memoryUsage().heapTotal,
          external: process.memoryUsage().external,
        },
        bot: bot.botInfo.username,
      });
    } catch (error) {
      res.status(500).json({
        status: 'error',
        error: error.message,
      });
    }
  });
  
  // Webhook endpoint
  app.use('/webhook', webhookCallback(bot, 'express'));
  
  // Start server
  httpServer = app.listen(config.webhookPort, () => {
    logger.info(`🌐 Webhook server listening on port ${config.webhookPort}`);
  });
  
  // Set webhook
  const webhookUrl = `${config.webhookUrl}/webhook`;
  await bot.api.setWebhook(webhookUrl, {
    secret_token: config.webhookSecret || undefined,
  });
  logger.info(`✅ Webhook set to: ${webhookUrl}`);
}

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
    logger.info('✅ Bot commands registered');
  } catch (error) {
    logger.error('⚠️  Failed to register bot commands:', error.message);
  }
}

/**
 * Graceful shutdown
 */
async function gracefulShutdown(signal) {
  logger.info(`\n👋 Received ${signal}, shutting down gracefully...`);
  
  // Stop accepting new requests
  if (httpServer) {
    await new Promise((resolve) => {
      httpServer.close((err) => {
        if (err) {
          logger.error('⚠️  Error closing HTTP server:', err.message);
        } else {
          logger.info('✅ HTTP server closed');
        }
        resolve();
      });
    });
  }
  
  // Stop scheduler
  stopScheduler();
  
  // Stop channel guard
  stopChannelGuard();
  
  // Stop power monitor
  stopPowerMonitor();
  
  // Stop bot
  if (bot) {
    try {
      await bot.stop();
      logger.info('✅ Bot stopped');
    } catch (error) {
      logger.error('⚠️  Error stopping bot:', error.message);
    }
  }
  
  // Close Redis connection
  await closeRedis();
  
  logger.info('✅ Shutdown complete');
  process.exit(0);
}

// Register shutdown handlers
process.once('SIGINT', () => gracefulShutdown('SIGINT'));
process.once('SIGTERM', () => gracefulShutdown('SIGTERM'));

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  logger.error('❌ Uncaught Exception:', error);
  gracefulShutdown('uncaughtException');
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
});

// Start the bot
main().catch((error) => {
  logger.error('❌ Failed to start bot:', error);
  process.exit(1);
});
