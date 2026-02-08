import { getAllUserIds, get, setUserData } from '../storage/index.js';
import { verifyChannelBranding } from '../services/channel.js';

let channelGuardJob = null;
let botInstance = null;

// Grace period: 24 hours in milliseconds
const GRACE_PERIOD_MS = 24 * 60 * 60 * 1000;

/**
 * Initialize channel guard with bot instance
 */
export function initChannelGuard(bot) {
  botInstance = bot;
  console.log('✅ Channel guard initialized');
  startChannelGuard();
}

/**
 * Start the channel guard job
 * Runs daily at 03:00 Kyiv time (01:00 UTC)
 */
function startChannelGuard() {
  if (channelGuardJob) {
    clearInterval(channelGuardJob);
  }

  // Calculate time until next 01:00 UTC (03:00 Kyiv time)
  const now = new Date();
  const nextRun = new Date();
  nextRun.setUTCHours(1, 0, 0, 0);
  
  // If we've passed 01:00 UTC today, schedule for tomorrow
  if (now.getUTCHours() >= 1) {
    nextRun.setUTCDate(nextRun.getUTCDate() + 1);
  }

  const timeUntilNextRun = nextRun.getTime() - now.getTime();
  
  console.log(`🕐 Channel guard will run at ${nextRun.toISOString()}`);

  // Schedule first run
  setTimeout(() => {
    checkAllChannels();
    
    // Then run every 24 hours
    channelGuardJob = setInterval(() => {
      checkAllChannels();
    }, 24 * 60 * 60 * 1000);
  }, timeUntilNextRun);
}

/**
 * Stop the channel guard job
 */
export function stopChannelGuard() {
  if (channelGuardJob) {
    clearInterval(channelGuardJob);
    channelGuardJob = null;
    console.log('⏹️  Channel guard stopped');
  }
}

/**
 * Check all channels for branding violations
 */
async function checkAllChannels() {
  try {
    console.log('🔍 Channel guard: Starting daily check...');
    
    const userIds = await getAllUserIds();
    let checkedCount = 0;
    let violationCount = 0;
    
    // Check channels sequentially to avoid rate limits
    for (const userId of userIds) {
      try {
        const result = await checkUserChannel(userId);
        if (result.checked) {
          checkedCount++;
          if (result.violated) {
            violationCount++;
          }
        }
      } catch (error) {
        console.error(`Error checking channel for user ${userId}:`, error);
      }
    }
    
    console.log(`✅ Channel guard: Checked ${checkedCount} channels, found ${violationCount} violations`);
  } catch (error) {
    console.error('Error in channel guard:', error);
  }
}

/**
 * Check a single user's channel
 */
async function checkUserChannel(userId) {
  try {
    const userData = await get(`user:${userId}`);
    
    if (!userData) {
      return { checked: false };
    }

    // Skip if no channel connected
    if (!userData.channel_id || !userData.channel_title) {
      return { checked: false };
    }

    // Skip if already blocked
    if (userData.channel_status === 'blocked') {
      return { checked: false };
    }

    // Skip if notifications disabled
    if (!userData.notificationsEnabled) {
      return { checked: false };
    }

    // Verify channel branding
    const verification = await verifyChannelBranding(
      botInstance,
      userData.channel_id,
      userData.channel_title,
      userData.channel_description,
      userData.channel_photo_file_id
    );

    // Handle access errors (channel deleted, bot removed)
    if (verification.violations && verification.violations.includes('access_error')) {
      console.log(`⚠️  Channel ${userData.channel_id} is inaccessible (deleted or bot removed)`);
      return { checked: true, violated: false };
    }

    // Check for violations
    if (!verification.valid && verification.violations.length > 0) {
      // Check grace period
      const now = Date.now();
      const timeSinceUpdate = userData.channel_branding_updated_at 
        ? now - userData.channel_branding_updated_at 
        : GRACE_PERIOD_MS + 1; // If no timestamp, grace period expired

      if (timeSinceUpdate < GRACE_PERIOD_MS) {
        console.log(`⏳ Channel ${userData.channel_id} has violations but within grace period`);
        return { checked: true, violated: false };
      }

      // Grace period expired - block channel
      console.log(`🔴 Blocking channel ${userData.channel_id} due to violations: ${verification.violations.join(', ')}`);
      
      userData.channel_status = 'blocked';
      await setUserData(userId, userData);

      // Send notification to user
      await sendViolationNotification(userId, userData.channel_title, verification.violations);

      return { checked: true, violated: true };
    }

    return { checked: true, violated: false };

  } catch (error) {
    console.error(`Error checking channel for user ${userId}:`, error);
    return { checked: false };
  }
}

/**
 * Send violation notification to user
 */
async function sendViolationNotification(userId, channelTitle, violations) {
  try {
    if (!botInstance) {
      console.error('Bot instance not initialized');
      return;
    }

    const violationText = violations
      .map(v => {
        switch(v) {
          case 'title': return 'назву';
          case 'description': return 'опис';
          case 'photo': return 'фото';
          default: return v;
        }
      })
      .join(', ');

    const message = `⚠️ <b>Виявлено зміни в каналі "${channelTitle}"</b>

Ви змінили ${violationText} каналу, що заборонено правилами використання Вольтик.

🔴 <b>Моніторинг зупинено.</b>

Щоб відновити роботу, перейдіть в:
Налаштування → Канал → Підключити канал`;

    await botInstance.api.sendMessage(userId, message, {
      parse_mode: 'HTML',
    });

    console.log(`✅ Sent violation notification to user ${userId}`);
  } catch (error) {
    console.error(`Failed to send violation notification to user ${userId}:`, error);
  }
}

/**
 * Manual check (for testing or on-demand checks)
 */
export async function runChannelGuardNow() {
  console.log('🔍 Running channel guard manually...');
  await checkAllChannels();
}
