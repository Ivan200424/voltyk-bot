/**
 * Publisher module for sending messages to channels
 */

import { InputFile } from 'grammy';
import { formatChannelMessage } from './formatter.js';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Path to channel photo
const CHANNEL_PHOTO_PATH = path.join(__dirname, '..', 'photo_for_channels.PNG.jpg');

/**
 * Publish schedule to channel with photo
 * @param {Object} bot - Bot instance
 * @param {string} channelId - Channel ID
 * @param {Object} scheduleData - Schedule data
 * @param {string} region - Region name
 * @param {string} queue - Queue
 * @param {string} customDescription - Custom description (optional)
 * @returns {Promise<Object|null>} Sent message or null if failed
 */
export async function publishToChannel(bot, channelId, scheduleData, region, queue, customDescription = '') {
  try {
    const caption = formatChannelMessage(scheduleData, region, queue, customDescription);
    
    // Send photo with caption
    const message = await bot.api.sendPhoto(channelId, new InputFile(CHANNEL_PHOTO_PATH), {
      caption,
      parse_mode: 'HTML',
    });
    
    return message;
  } catch (error) {
    console.error(`Error publishing to channel ${channelId}:`, error);
    return null;
  }
}

/**
 * Update existing channel message
 * @param {Object} bot - Bot instance
 * @param {string} channelId - Channel ID
 * @param {number} messageId - Message ID to edit
 * @param {Object} scheduleData - Schedule data
 * @param {string} region - Region name
 * @param {string} queue - Queue
 * @param {string} customDescription - Custom description (optional)
 * @returns {Promise<boolean>} True if successful
 */
export async function updateChannelMessage(bot, channelId, messageId, scheduleData, region, queue, customDescription = '') {
  try {
    const caption = formatChannelMessage(scheduleData, region, queue, customDescription);
    
    await bot.api.editMessageCaption(channelId, messageId, {
      caption,
      parse_mode: 'HTML',
    });
    
    return true;
  } catch (error) {
    console.error(`Error updating channel message ${channelId}/${messageId}:`, error);
    return false;
  }
}
