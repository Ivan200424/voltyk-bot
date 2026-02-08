require('dotenv').config();

const config = {
  botToken: process.env.BOT_TOKEN,
  ownerId: process.env.OWNER_ID,
  adminIds: (process.env.ADMIN_IDS || '').split(',').filter(Boolean),
  botMode: process.env.BOT_MODE || 'webhook',
  webhookUrl: process.env.WEBHOOK_URL || '',
  webhookPort: parseInt(process.env.WEBHOOK_PORT || '3000', 10),
  webhookSecret: process.env.WEBHOOK_SECRET || '',
  redisHost: process.env.REDIS_HOST || 'localhost',
  redisPort: parseInt(process.env.REDIS_PORT || '6379', 10),
  redisPassword: process.env.REDIS_PASSWORD || undefined,
  redisDb: parseInt(process.env.REDIS_DB || '0', 10),
  timezone: process.env.TZ || 'Europe/Kyiv',
};

// Dynamic settings with Redis fallback
async function getIntervalSetting(dbKey, envKey, defaultValue) {
  try {
    const { getSetting } = require('./database/redis');
    const value = await getSetting(dbKey);
    if (value !== null) return parseInt(value, 10);
  } catch (error) {
    // Redis not available, use env/default
  }
  return parseInt(process.env[envKey] || String(defaultValue), 10);
}

function isAdmin(telegramId) {
  const id = String(telegramId);
  return config.adminIds.includes(id) || id === String(config.ownerId);
}

module.exports = { config, getIntervalSetting, isAdmin };
