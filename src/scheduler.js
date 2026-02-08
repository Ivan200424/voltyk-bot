const cron = require('node-cron');
const { createLogger } = require('./utils/logger');
const { config, getIntervalSetting } = require('./config');
const { getAllActiveUsers, getSetting } = require('./database/redis');
const { fetchScheduleData } = require('./api');
const { parseScheduleData, parseScheduleForQueue } = require('./parser');
const { detectChange, storeHash, filterEventsByDate } = require('./services/scheduleHashService');
const { buildMessagesForChanges } = require('./services/messageBuilder');
const { publishToUser } = require('./publisher');
const { getTodayDateString, getTomorrowDateString, getTodayDate, getTomorrowDate } = require('./utils/dateHelpers');
const { REGION_CODES } = require('./constants/regions');

const logger = createLogger('Scheduler');

// Scheduler configuration
const INTER_USER_DELAY_MS = 100; // Delay between processing users to avoid rate limits

let scheduledTasks = [];

/**
 * Process schedule changes for a single user
 * @param {Object} bot - Grammy bot instance
 * @param {Object} user - User object
 * @param {Object} scheduleData - Schedule data for the user's region
 * @returns {Promise<Object>} Processing results
 */
async function processUserSchedule(bot, user, scheduleData) {
  const results = {
    messagesBuilt: 0,
    messagesSent: 0,
    errors: [],
  };
  
  try {
    // Skip if user doesn't have region or queue configured
    if (!user.region || !user.queue) {
      logger.debug(`User ${user.chatId} missing region or queue, skipping`);
      return results;
    }
    
    // Parse schedule data
    const parsed = parseScheduleData(scheduleData);
    if (!parsed) {
      logger.warn(`Failed to parse schedule for region ${user.region}`);
      return results;
    }
    
    // Get queue schedule using new parser
    const queueData = parseScheduleForQueue(parsed, user.queue);
    if (!queueData || !queueData.hasData) {
      logger.debug(`No schedule found for queue ${user.queue} in region ${user.region}`);
      return results;
    }
    
    // Get today and tomorrow date strings
    const todayDateStr = getTodayDateString();
    const tomorrowDateStr = getTomorrowDateString();
    
    // Filter events for today and tomorrow
    const todayEvents = filterEventsByDate(queueData.events || [], todayDateStr);
    const tomorrowEvents = filterEventsByDate(queueData.events || [], tomorrowDateStr);
    
    // Detect changes for today and tomorrow
    const todayChange = await detectChange(user.region, user.queue, 'today', todayEvents);
    const tomorrowChange = await detectChange(user.region, user.queue, 'tomorrow', tomorrowEvents);
    
    // Build messages based on detected changes
    const messages = buildMessagesForChanges({
      queue: user.queue,
      todayDate: getTodayDate(),
      tomorrowDate: getTomorrowDate(),
      todayEvents,
      tomorrowEvents,
      todayChange,
      tomorrowChange,
    });
    
    results.messagesBuilt = messages.length;
    
    // If no messages, skip publishing
    if (messages.length === 0) {
      return results;
    }
    
    // Publish messages to user
    const publishResults = await publishToUser(bot, user, messages);
    results.messagesSent = publishResults.bot.success + publishResults.channel.success;
    
    // Update stored hashes only if publishing succeeded
    if (results.messagesSent > 0) {
      if (todayChange.currentHash !== null) {
        await storeHash(user.region, user.queue, 'today', todayChange.currentHash);
      }
      if (tomorrowChange.currentHash !== null) {
        await storeHash(user.region, user.queue, 'tomorrow', tomorrowChange.currentHash);
      }
    }
    
    logger.info(`Processed user ${user.chatId}: ${results.messagesBuilt} messages built, ${results.messagesSent} sent`);
  } catch (error) {
    logger.error(`Error processing user ${user.chatId}:`, error.message);
    results.errors.push(error.message);
  }
  
  return results;
}

/**
 * Main scheduler task - check schedules and publish updates
 * @param {Object} bot - Grammy bot instance
 */
async function checkSchedules(bot) {
  logger.info('=== Starting schedule check ===');
  
  try {
    // Check if scheduler is paused
    const paused = await getSetting('scheduler_paused');
    if (paused === 'true') {
      logger.info('Scheduler is paused, skipping this run');
      return;
    }
    
    // Fetch all active users
    const users = await getAllActiveUsers();
    logger.info(`Found ${users.length} active users`);
    
    if (users.length === 0) {
      logger.info('No active users, nothing to do');
      return;
    }
    
    // Group users by region to minimize API calls
    const usersByRegion = {};
    for (const user of users) {
      if (user.region && user.queue) {
        if (!usersByRegion[user.region]) {
          usersByRegion[user.region] = [];
        }
        usersByRegion[user.region].push(user);
      }
    }
    
    logger.info(`Processing ${Object.keys(usersByRegion).length} regions`);
    
    // Statistics
    const stats = {
      totalUsers: users.length,
      processedUsers: 0,
      usersWithMessages: 0,
      totalMessages: 0,
      errors: 0,
    };
    
    // Process each region
    for (const region of Object.keys(usersByRegion)) {
      try {
        logger.info(`Fetching schedule for region: ${region}`);
        
        // Fetch schedule data for this region
        const scheduleData = await fetchScheduleData(region);
        
        if (!scheduleData) {
          logger.warn(`Failed to fetch schedule for region ${region}`);
          continue;
        }
        
        const regionUsers = usersByRegion[region];
        logger.info(`Processing ${regionUsers.length} users in region ${region}`);
        
        // Process each user in this region
        for (const user of regionUsers) {
          const results = await processUserSchedule(bot, user, scheduleData);
          stats.processedUsers++;
          
          if (results.messagesBuilt > 0) {
            stats.usersWithMessages++;
            stats.totalMessages += results.messagesSent;
          }
          
          if (results.errors.length > 0) {
            stats.errors += results.errors.length;
          }
          
          // Small delay between users to avoid rate limits
          await new Promise(resolve => setTimeout(resolve, INTER_USER_DELAY_MS));
        }
      } catch (error) {
        logger.error(`Error processing region ${region}:`, error.message);
        stats.errors++;
      }
    }
    
    logger.info('=== Schedule check complete ===');
    logger.info(`Stats: ${stats.processedUsers} users processed, ${stats.usersWithMessages} with updates, ${stats.totalMessages} messages sent, ${stats.errors} errors`);
  } catch (error) {
    logger.error('Error in schedule check:', error);
  }
}

/**
 * Initialize scheduler
 * @param {Object} bot - Grammy bot instance
 */
function initScheduler(bot) {
  logger.info('Initializing scheduler...');
  
  // Get interval from config (default: every 5 minutes)
  // Note: We can't use async here, so we'll use the default and let it update dynamically
  const defaultInterval = '*/5 * * * *'; // Every 5 minutes
  
  // Schedule task
  const task = cron.schedule(defaultInterval, async () => {
    logger.info('Running scheduled task: checking schedules');
    await checkSchedules(bot);
  });
  
  scheduledTasks.push(task);
  
  logger.info(`Scheduler initialized with interval: ${defaultInterval}`);
}

/**
 * Stop scheduler
 */
function stopScheduler() {
  logger.info('Stopping scheduler...');
  scheduledTasks.forEach(task => task.stop());
  scheduledTasks = [];
  logger.info('Scheduler stopped');
}

module.exports = {
  initScheduler,
  stopScheduler,
  checkSchedules, // Export for testing
};
