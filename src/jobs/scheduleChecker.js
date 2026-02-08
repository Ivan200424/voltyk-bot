import { 
  getScheduleData, 
  getScheduleHashes, 
  updateScheduleHashes,
  detectScheduleChanges,
  getCheckInterval,
  getKyivDateString
} from '../services/schedule.js';
import { formatAutoPublishMessage } from '../handlers/schedule.js';
import { get, getAllUserIds } from '../storage/index.js';

let scheduleCheckJob = null;
let botInstance = null;

/**
 * Initialize schedule checker with bot instance
 */
export function initScheduleChecker(bot) {
  botInstance = bot;
  console.log('✅ Schedule checker initialized');
  startScheduleChecker();
}

/**
 * Start the schedule checking job
 */
async function startScheduleChecker() {
  if (scheduleCheckJob) {
    clearInterval(scheduleCheckJob);
  }
  
  const interval = await getCheckInterval();
  console.log(`🕐 Schedule checker started (interval: ${interval}ms)`);
  
  // Check immediately on start
  await checkAllUsersSchedules();
  
  // Then check periodically
  scheduleCheckJob = setInterval(async () => {
    await checkAllUsersSchedules();
  }, interval);
}

/**
 * Stop the schedule checking job
 */
export function stopScheduleChecker() {
  if (scheduleCheckJob) {
    clearInterval(scheduleCheckJob);
    scheduleCheckJob = null;
    console.log('⏹️  Schedule checker stopped');
  }
}

/**
 * Restart schedule checker with new interval
 */
export async function restartScheduleChecker() {
  stopScheduleChecker();
  await startScheduleChecker();
}

/**
 * Check schedules for all users
 * Uses Promise.allSettled for concurrent processing
 */
async function checkAllUsersSchedules() {
  try {
    // Get all user IDs from storage
    const userIds = await getAllUserIds();
    
    // Process users concurrently with error handling
    await Promise.allSettled(
      userIds.map(userId => checkUserSchedule(userId))
    );
  } catch (error) {
    console.error('Error checking schedules:', error);
  }
}

/**
 * Check schedule for a single user
 */
async function checkUserSchedule(userId) {
  try {
    // Get user data
    const userData = await get(`user:${userId}`);
    
    if (!userData || !userData.region || !userData.queue) {
      return; // User not configured
    }
    
    if (!userData.notificationsEnabled) {
      return; // Notifications disabled
    }
    
    // Get current schedule data
    const scheduleData = await getScheduleData(userData.region, userData.queue);
    
    if (!scheduleData) {
      return; // Schedule unavailable
    }
    
    // Get cached hashes
    const oldHashes = await getScheduleHashes(userId);
    
    // Get current Kyiv date
    const currentDate = getKyivDateString();
    
    // Detect changes with date-aware logic
    const changes = detectScheduleChanges(oldHashes, scheduleData, currentDate);
    
    // Check if anything changed
    const hasChanges = changes.todayChanged || changes.todayIsNew || 
                       changes.tomorrowChanged || changes.tomorrowIsNew;
    
    if (!hasChanges) {
      return; // No changes, don't publish
    }
    
    // Update hashes with current date
    await updateScheduleHashes(
      userId, 
      scheduleData.today.hash,
      scheduleData.tomorrow ? scheduleData.tomorrow.hash : null,
      currentDate
    );
    
    // Format message based on changes
    const message = formatAutoPublishMessage(scheduleData, userData.queue, changes);
    
    // Publish to configured destination
    await publishSchedule(userData, message, scheduleData);
    
  } catch (error) {
    console.error(`Error checking schedule for user ${userId}:`, error);
  }
}

/**
 * Publish schedule to configured destination
 */
async function publishSchedule(userData, message, scheduleData) {
  try {
    if (!botInstance) {
      console.error('Bot instance not initialized');
      return;
    }
    
    const imageUrl = scheduleData.today.imageUrl;
    
    // Publish to bot (private messages)
    if (userData.notifyTo === 'bot' || !userData.notifyTo) {
      try {
        await botInstance.api.sendPhoto(userData.id, imageUrl, {
          caption: message,
          parse_mode: 'MarkdownV2',
        });
        console.log(`✅ Schedule published to user ${userData.id} (bot)`);
      } catch (error) {
        console.error(`Failed to publish to user ${userData.id}:`, error);
      }
    }
    
    // Publish to channel
    if (userData.notifyTo === 'channel' && userData.channelId) {
      try {
        await botInstance.api.sendPhoto(userData.channelId, imageUrl, {
          caption: message,
          parse_mode: 'MarkdownV2',
        });
        console.log(`✅ Schedule published to channel ${userData.channelId}`);
      } catch (error) {
        console.error(`Failed to publish to channel ${userData.channelId}:`, error);
      }
    }
  } catch (error) {
    console.error('Error publishing schedule:', error);
  }
}
