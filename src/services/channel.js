import { InputFile } from 'grammy';
import { readFile } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Base channel description (mandatory footer)
const CHANNEL_DESCRIPTION_BASE = '⚡️ Вольтик — слідкує, щоб ти не слідкував';

// Channel title prefix
const CHANNEL_TITLE_PREFIX = 'Вольтик ⚡️ ';

/**
 * Apply full branding to a channel (title, description, photo)
 */
export async function applyChannelBranding(bot, channelId, userTitle, userDescription = null) {
  const results = {
    title: { success: false, error: null },
    description: { success: false, error: null },
    photo: { success: false, error: null, fileId: null },
  };

  // 1. Set channel title
  const fullTitle = CHANNEL_TITLE_PREFIX + userTitle;
  try {
    await bot.api.setChatTitle(channelId, fullTitle);
    results.title.success = true;
  } catch (error) {
    results.title.error = error.message;
    console.error(`Failed to set channel title for ${channelId}:`, error);
    // Title is critical - return immediately if it fails
    return results;
  }

  // 2. Set channel description
  const botUsername = bot.botInfo.username;
  const botLink = `🤖 @${botUsername}`;
  const fullDescription = userDescription 
    ? `${userDescription}\n\n${CHANNEL_DESCRIPTION_BASE}\n${botLink}`
    : `${CHANNEL_DESCRIPTION_BASE}\n${botLink}`;
  
  try {
    await bot.api.setChatDescription(channelId, fullDescription);
    results.description.success = true;
  } catch (error) {
    results.description.error = error.message;
    console.error(`Failed to set channel description for ${channelId}:`, error);
    // Description is critical - return immediately if it fails
    return results;
  }

  // 3. Set channel photo
  try {
    // Path to photo file (2 levels up from services directory to repo root)
    const photoPath = join(__dirname, '..', '..', 'photo_for_channels.PNG.jpg');
    const photoBuffer = await readFile(photoPath);
    
    await bot.api.setChatPhoto(channelId, new InputFile(photoBuffer));
    
    // Get the file_id of the set photo
    const chat = await bot.api.getChat(channelId);
    if (chat.photo && chat.photo.big_file_id) {
      results.photo.fileId = chat.photo.big_file_id;
      results.photo.success = true;
    }
  } catch (error) {
    results.photo.error = error.message;
    console.error(`Failed to set channel photo for ${channelId}:`, error);
    // Photo is non-critical - continue even if it fails
  }

  return results;
}

/**
 * Verify channel has admin permissions
 */
export async function verifyChannelPermissions(bot, channelId) {
  try {
    const botMember = await bot.api.getChatMember(channelId, bot.botInfo.id);
    
    if (botMember.status !== 'administrator') {
      return {
        valid: false,
        error: 'Bot is not an administrator in the channel',
      };
    }

    // Check required permissions
    const hasPostPermission = botMember.can_post_messages;
    const hasChangeInfoPermission = botMember.can_change_info;

    if (!hasPostPermission || !hasChangeInfoPermission) {
      return {
        valid: false,
        error: 'Bot lacks required permissions (can_post_messages, can_change_info)',
      };
    }

    return { valid: true, error: null };
  } catch (error) {
    return {
      valid: false,
      error: error.message,
    };
  }
}

/**
 * Check if channel is occupied by another user
 */
export async function isChannelOccupied(channelId, currentUserId, allUserIds, getUserData) {
  for (const userId of allUserIds) {
    if (userId === currentUserId) continue;
    
    const userData = await getUserData(userId);
    if (userData.channel_id === channelId) {
      return { occupied: true, occupiedBy: userId };
    }
  }
  
  return { occupied: false, occupiedBy: null };
}

/**
 * Verify channel branding matches expected values
 */
export async function verifyChannelBranding(bot, channelId, expectedTitle, expectedDescription, expectedPhotoFileId) {
  try {
    const chat = await bot.api.getChat(channelId);
    
    const violations = [];
    
    // Check title
    if (chat.title !== expectedTitle) {
      violations.push('title');
    }
    
    // Check description
    if (chat.description !== expectedDescription) {
      violations.push('description');
    }
    
    // Check photo (if we have expected file_id)
    if (expectedPhotoFileId) {
      const currentPhotoFileId = chat.photo?.big_file_id;
      if (currentPhotoFileId !== expectedPhotoFileId) {
        violations.push('photo');
      }
    }
    
    return {
      valid: violations.length === 0,
      violations,
      currentData: {
        title: chat.title,
        description: chat.description,
        photoFileId: chat.photo?.big_file_id,
      },
    };
  } catch (error) {
    return {
      valid: false,
      violations: ['access_error'],
      error: error.message,
    };
  }
}

/**
 * Send welcome message to newly connected channel
 */
export async function sendChannelWelcomeMessage(bot, channelId, queue, hasIpMonitoring) {
  const lines = [
    '👋 Цей канал підключено до Вольтика — чат-бота для моніторингу світла.',
    '',
    'Тут публікуватимуться:',
    '• 📊 Графіки відключень',
  ];
  
  if (hasIpMonitoring) {
    lines.push('• ⚡ Сповіщення про стан світла');
  }
  
  lines.push('', `Черга: ${queue}`);
  
  const message = lines.join('\n');
  
  try {
    await bot.api.sendMessage(channelId, message, {
      parse_mode: 'HTML',
    });
    return { success: true };
  } catch (error) {
    console.error(`Failed to send welcome message to channel ${channelId}:`, error);
    return { success: false, error: error.message };
  }
}

/**
 * Migrate existing channels (check if branding is correct)
 */
export async function migrateExistingChannel(bot, userData) {
  // Only migrate if channel is connected but branding fields are empty
  if (!userData.channelId || userData.channel_title) {
    return { needsMigration: false };
  }

  try {
    const chat = await bot.api.getChat(userData.channelId);
    
    // Check if title already has the correct prefix
    if (chat.title && chat.title.startsWith(CHANNEL_TITLE_PREFIX)) {
      // Channel is already correct - just update DB
      return {
        needsMigration: false,
        alreadyCorrect: true,
        currentTitle: chat.title,
        currentDescription: chat.description,
        currentPhotoFileId: chat.photo?.big_file_id,
      };
    } else {
      // Channel needs migration (title doesn't have prefix)
      return {
        needsMigration: true,
        alreadyCorrect: false,
        currentTitle: chat.title,
      };
    }
  } catch (error) {
    // Channel might be deleted or bot removed
    return {
      needsMigration: false,
      error: error.message,
    };
  }
}

export { CHANNEL_TITLE_PREFIX, CHANNEL_DESCRIPTION_BASE };
