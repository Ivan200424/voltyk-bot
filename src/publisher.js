const fs = require('fs');
const path = require('path');
const { InputFile } = require('grammy');
const { createLogger } = require('./utils/logger');
const { setCache, getCache } = require('./database/redis');

const logger = createLogger('Publisher');

// Rate limiting configuration
const MESSAGE_DELAY_MS = 50; // Delay between messages to avoid Telegram API rate limits

// Cache for photo file_id to avoid re-uploading
let cachedPhotoFileId = null;

/**
 * Load photo file from disk
 * @returns {Buffer} Photo file buffer
 */
function loadPhotoFile() {
  const photoPath = path.resolve(__dirname, '../photo_for_channels.PNG.jpg');
  return fs.readFileSync(photoPath);
}

/**
 * Get or load cached photo file_id
 * @returns {Promise<string|null>} Cached file_id or null
 */
async function getCachedPhotoFileId() {
  if (cachedPhotoFileId) {
    return cachedPhotoFileId;
  }
  
  // Try to get from Redis
  const cached = await getCache('photo_file_id');
  if (cached) {
    cachedPhotoFileId = cached;
    logger.debug('Loaded photo file_id from Redis cache');
    return cached;
  }
  
  return null;
}

/**
 * Cache photo file_id
 * @param {string} fileId - Telegram file_id
 */
async function cachePhotoFileId(fileId) {
  cachedPhotoFileId = fileId;
  await setCache('photo_file_id', fileId, 86400 * 7); // 7 days
  logger.info('Cached photo file_id');
}

/**
 * Publish message to bot (DM) - text only
 * @param {Object} bot - Grammy bot instance
 * @param {number} chatId - User chat ID
 * @param {string} text - Message text (HTML)
 * @returns {Promise<boolean>} Success status
 */
async function publishToBot(bot, chatId, text) {
  try {
    await bot.api.sendMessage(chatId, text, { parse_mode: 'HTML' });
    logger.debug(`Published to bot DM: ${chatId}`);
    return true;
  } catch (error) {
    logger.error(`Failed to publish to bot DM ${chatId}:`, error.message);
    return false;
  }
}

/**
 * Publish message to channel with photo
 * @param {Object} bot - Grammy bot instance
 * @param {number|string} channelId - Channel ID
 * @param {string} text - Caption text (HTML)
 * @returns {Promise<boolean>} Success status
 */
async function publishToChannelWithPhoto(bot, channelId, text) {
  try {
    // Try to use cached file_id first
    const cachedFileId = await getCachedPhotoFileId();
    
    if (cachedFileId) {
      try {
        await bot.api.sendPhoto(channelId, cachedFileId, {
          caption: text,
          parse_mode: 'HTML',
        });
        logger.debug(`Published to channel with cached photo: ${channelId}`);
        return true;
      } catch (error) {
        // Cache might be invalid, try uploading
        logger.warn('Cached photo file_id failed, will try uploading');
      }
    }
    
    // Load and upload photo
    const photoBuffer = loadPhotoFile();
    const inputFile = new InputFile(photoBuffer, 'schedule.jpg');
    
    const result = await bot.api.sendPhoto(channelId, inputFile, {
      caption: text,
      parse_mode: 'HTML',
    });
    
    // Cache the file_id for future use
    if (result && result.photo && result.photo.length > 0) {
      const fileId = result.photo[result.photo.length - 1].file_id;
      await cachePhotoFileId(fileId);
    }
    
    logger.debug(`Published to channel with photo: ${channelId}`);
    return true;
  } catch (error) {
    logger.error(`Failed to publish to channel with photo ${channelId}:`, error.message);
    return false;
  }
}

/**
 * Publish message to channel without photo (fallback)
 * @param {Object} bot - Grammy bot instance
 * @param {number|string} channelId - Channel ID
 * @param {string} text - Message text (HTML)
 * @returns {Promise<boolean>} Success status
 */
async function publishToChannelWithoutPhoto(bot, channelId, text) {
  try {
    await bot.api.sendMessage(channelId, text, { parse_mode: 'HTML' });
    logger.debug(`Published to channel without photo: ${channelId}`);
    return true;
  } catch (error) {
    logger.error(`Failed to publish to channel without photo ${channelId}:`, error.message);
    return false;
  }
}

/**
 * Publish message to channel (tries with photo, falls back to text-only)
 * @param {Object} bot - Grammy bot instance
 * @param {number|string} channelId - Channel ID
 * @param {string} text - Message text/caption (HTML)
 * @param {Object} options - Publishing options
 * @returns {Promise<boolean>} Success status
 */
async function publishToChannel(bot, channelId, text, options = {}) {
  // Try with photo first
  const success = await publishToChannelWithPhoto(bot, channelId, text);
  
  if (!success) {
    // Fallback to text-only
    logger.warn(`Photo publish failed for channel ${channelId}, trying text-only`);
    return await publishToChannelWithoutPhoto(bot, channelId, text);
  }
  
  return success;
}

/**
 * Publish multiple messages to a target with rate limiting
 * @param {Object} bot - Grammy bot instance
 * @param {number|string} targetId - Chat or channel ID
 * @param {Array} messages - Array of message objects with {text} property
 * @param {string} targetType - 'bot' or 'channel'
 * @param {number} delayMs - Delay between messages in milliseconds (default: MESSAGE_DELAY_MS)
 * @returns {Promise<Object>} Results object with success count and errors
 */
async function publishBatch(bot, targetId, messages, targetType = 'bot', delayMs = MESSAGE_DELAY_MS) {
  const results = {
    success: 0,
    failed: 0,
    errors: [],
  };
  
  for (let i = 0; i < messages.length; i++) {
    const message = messages[i];
    
    // Add delay between messages (except for the first one)
    if (i > 0 && delayMs > 0) {
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }
    
    let success;
    if (targetType === 'channel') {
      success = await publishToChannel(bot, targetId, message.text);
    } else {
      success = await publishToBot(bot, targetId, message.text);
    }
    
    if (success) {
      results.success++;
    } else {
      results.failed++;
      results.errors.push(`Failed to send message ${i + 1}`);
    }
  }
  
  return results;
}

/**
 * Publish to user based on their notification settings
 * @param {Object} bot - Grammy bot instance
 * @param {Object} user - User object from database
 * @param {Array} messages - Array of message objects
 * @returns {Promise<Object>} Results object
 */
async function publishToUser(bot, user, messages) {
  const results = {
    bot: { success: 0, failed: 0 },
    channel: { success: 0, failed: 0 },
  };
  
  if (!messages || messages.length === 0) {
    return results;
  }
  
  const notifyTarget = user.notifyTarget || 'bot';
  
  // Publish to bot DM
  if (notifyTarget === 'bot' || notifyTarget === 'both') {
    const botResults = await publishBatch(bot, user.chatId, messages, 'bot', MESSAGE_DELAY_MS);
    results.bot = botResults;
    logger.info(`Published ${botResults.success}/${messages.length} messages to user ${user.chatId} (bot)`);
  }
  
  // Publish to channel
  if ((notifyTarget === 'channel' || notifyTarget === 'both') && user.channelId) {
    const channelResults = await publishBatch(bot, user.channelId, messages, 'channel', MESSAGE_DELAY_MS);
    results.channel = channelResults;
    logger.info(`Published ${channelResults.success}/${messages.length} messages to channel ${user.channelId}`);
  }
  
  return results;
}

module.exports = {
  publishToBot,
  publishToChannel,
  publishToChannelWithPhoto,
  publishToChannelWithoutPhoto,
  publishBatch,
  publishToUser,
};
