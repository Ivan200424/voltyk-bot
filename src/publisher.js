const axios = require('axios');
const { InputFile } = require('grammy');
const { createLogger } = require('./utils/logger');
const { setCache, getCache } = require('./database/redis');

const logger = createLogger('Publisher');

// Rate limiting configuration
const MESSAGE_DELAY_MS = 50; // Delay between messages to avoid Telegram API rate limits

// Base URL for queue emergency images
const IMAGES_BASE_URL = 'https://raw.githubusercontent.com/Baskerville42/outage-data-ua/main/images';

/**
 * Fetch queue-specific emergency photo from GitHub
 * @param {string} region - Region code (e.g., 'kyiv', 'dnipro')
 * @param {string} queue - Queue identifier (e.g., '3.1', '15.2')
 * @returns {Promise<Buffer|null>} Image buffer or null on failure
 */
async function fetchQueuePhoto(region, queue) {
  try {
    // Parse queue into group and subgroup
    const [group, subgroup] = queue.split('.');
    
    if (!group || !subgroup) {
      logger.error(`Invalid queue format: ${queue}`);
      return null;
    }
    
    // Construct image URL
    const imageUrl = `${IMAGES_BASE_URL}/${region}/gpv-${group}-${subgroup}-emergency.png`;
    logger.debug(`Fetching queue photo from: ${imageUrl}`);
    
    // Fetch image with timeout
    const response = await axios.get(imageUrl, {
      responseType: 'arraybuffer',
      timeout: 10000,
      headers: {
        'User-Agent': 'Voltyk-Bot/2.0',
      },
    });
    
    if (response.status === 200 && response.data) {
      logger.info(`Successfully fetched queue photo for ${region}/${queue}`);
      return Buffer.from(response.data);
    }
    
    logger.warn(`Invalid response for queue photo ${region}/${queue}:`, response.status);
    return null;
  } catch (error) {
    logger.error(`Error fetching queue photo for ${region}/${queue}:`, error.message);
    return null;
  }
}

/**
 * Get or load cached photo file_id for specific region and queue
 * @param {string} region - Region code
 * @param {string} queue - Queue identifier
 * @returns {Promise<string|null>} Cached file_id or null
 */
async function getCachedPhotoFileId(region, queue) {
  const cacheKey = `photo_file_id:${region}:${queue}`;
  const cached = await getCache(cacheKey);
  
  if (cached) {
    logger.debug(`Loaded photo file_id from Redis cache for ${region}/${queue}`);
    return cached;
  }
  
  return null;
}

/**
 * Cache photo file_id for specific region and queue
 * @param {string} region - Region code
 * @param {string} queue - Queue identifier
 * @param {string} fileId - Telegram file_id
 */
async function cachePhotoFileId(region, queue, fileId) {
  const cacheKey = `photo_file_id:${region}:${queue}`;
  await setCache(cacheKey, fileId, 86400 * 7); // 7 days
  logger.info(`Cached photo file_id for ${region}/${queue}`);
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
 * Publish message to bot (DM) with photo
 * @param {Object} bot - Grammy bot instance
 * @param {number} chatId - User chat ID
 * @param {string} text - Caption text (HTML)
 * @param {string} region - Region code (e.g., 'kyiv')
 * @param {string} queue - Queue identifier (e.g., '3.1')
 * @returns {Promise<boolean>} Success status
 */
async function publishToBotWithPhoto(bot, chatId, text, region, queue) {
  try {
    // Try to use cached file_id first
    const cachedFileId = await getCachedPhotoFileId(region, queue);
    
    if (cachedFileId) {
      try {
        await bot.api.sendPhoto(chatId, cachedFileId, {
          caption: text,
          parse_mode: 'HTML',
        });
        logger.debug(`Published to bot DM with cached photo: ${chatId}`);
        return true;
      } catch (error) {
        // Cache might be invalid, try fetching
        logger.warn('Cached photo file_id failed, will try fetching');
      }
    }
    
    // Fetch queue-specific photo
    const photoBuffer = await fetchQueuePhoto(region, queue);
    
    if (!photoBuffer) {
      logger.warn(`Failed to fetch queue photo for ${region}/${queue}, will fall back to text-only`);
      return false;
    }
    
    const inputFile = new InputFile(photoBuffer, 'schedule.png');
    
    const result = await bot.api.sendPhoto(chatId, inputFile, {
      caption: text,
      parse_mode: 'HTML',
    });
    
    // Cache the file_id for future use
    if (result && result.photo && result.photo.length > 0) {
      const fileId = result.photo[result.photo.length - 1].file_id;
      await cachePhotoFileId(region, queue, fileId);
    }
    
    logger.debug(`Published to bot DM with photo: ${chatId}`);
    return true;
  } catch (error) {
    logger.error(`Failed to publish to bot DM with photo ${chatId}:`, error.message);
    return false;
  }
}

/**
 * Publish message to channel with photo
 * @param {Object} bot - Grammy bot instance
 * @param {number|string} channelId - Channel ID
 * @param {string} text - Caption text (HTML)
 * @param {string} region - Region code (e.g., 'kyiv')
 * @param {string} queue - Queue identifier (e.g., '3.1')
 * @returns {Promise<boolean>} Success status
 */
async function publishToChannelWithPhoto(bot, channelId, text, region, queue) {
  try {
    // Try to use cached file_id first
    const cachedFileId = await getCachedPhotoFileId(region, queue);
    
    if (cachedFileId) {
      try {
        await bot.api.sendPhoto(channelId, cachedFileId, {
          caption: text,
          parse_mode: 'HTML',
        });
        logger.debug(`Published to channel with cached photo: ${channelId}`);
        return true;
      } catch (error) {
        // Cache might be invalid, try fetching
        logger.warn('Cached photo file_id failed, will try fetching');
      }
    }
    
    // Fetch queue-specific photo
    const photoBuffer = await fetchQueuePhoto(region, queue);
    
    if (!photoBuffer) {
      logger.warn(`Failed to fetch queue photo for ${region}/${queue}, will fall back to text-only`);
      return false;
    }
    
    const inputFile = new InputFile(photoBuffer, 'schedule.png');
    
    const result = await bot.api.sendPhoto(channelId, inputFile, {
      caption: text,
      parse_mode: 'HTML',
    });
    
    // Cache the file_id for future use
    if (result && result.photo && result.photo.length > 0) {
      const fileId = result.photo[result.photo.length - 1].file_id;
      await cachePhotoFileId(region, queue, fileId);
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
 * @param {string} region - Region code
 * @param {string} queue - Queue identifier
 * @param {Object} options - Publishing options
 * @returns {Promise<boolean>} Success status
 */
async function publishToChannel(bot, channelId, text, region, queue, options = {}) {
  // Try with photo first
  const success = await publishToChannelWithPhoto(bot, channelId, text, region, queue);
  
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
 * @param {string} region - Region code (required for channel publishing)
 * @param {string} queue - Queue identifier (required for channel publishing)
 * @param {number} delayMs - Delay between messages in milliseconds (default: MESSAGE_DELAY_MS)
 * @returns {Promise<Object>} Results object with success count and errors
 */
async function publishBatch(bot, targetId, messages, targetType = 'bot', region = null, queue = null, delayMs = MESSAGE_DELAY_MS) {
  const results = {
    success: 0,
    failed: 0,
    errors: [],
  };
  
  // Validate required parameters for channel publishing
  if (targetType === 'channel' && (!region || !queue)) {
    logger.error('Region and queue are required for channel publishing');
    results.failed = messages.length;
    results.errors.push('Missing region or queue for channel publishing');
    return results;
  }
  
  for (let i = 0; i < messages.length; i++) {
    const message = messages[i];
    
    // Add delay between messages (except for the first one)
    if (i > 0 && delayMs > 0) {
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }
    
    let success;
    if (targetType === 'channel') {
      success = await publishToChannel(bot, targetId, message.text, region, queue);
    } else if (targetType === 'bot' && region && queue) {
      // Try with photo first, fall back to text-only if photo fails
      success = await publishToBotWithPhoto(bot, targetId, message.text, region, queue);
      if (!success) {
        logger.warn(`Photo publish failed for bot DM ${targetId}, trying text-only`);
        success = await publishToBot(bot, targetId, message.text);
      }
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
    const botResults = await publishBatch(bot, user.chatId, messages, 'bot', user.region, user.queue, MESSAGE_DELAY_MS);
    results.bot = botResults;
    logger.info(`Published ${botResults.success}/${messages.length} messages to user ${user.chatId} (bot)`);
  }
  
  // Publish to channel
  if ((notifyTarget === 'channel' || notifyTarget === 'both') && user.channelId) {
    const channelResults = await publishBatch(bot, user.channelId, messages, 'channel', user.region, user.queue, MESSAGE_DELAY_MS);
    results.channel = channelResults;
    logger.info(`Published ${channelResults.success}/${messages.length} messages to channel ${user.channelId}`);
  }
  
  return results;
}

module.exports = {
  publishToBot,
  publishToBotWithPhoto,
  publishToChannel,
  publishToChannelWithPhoto,
  publishToChannelWithoutPhoto,
  publishBatch,
  publishToUser,
};
