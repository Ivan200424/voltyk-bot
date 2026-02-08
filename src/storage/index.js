import { initRedis, getRedis, setRedis, delRedis, isRedisAvailable, closeRedis } from './redis.js';
import { getMemory, setMemory, delMemory } from './memory.js';

let initialized = false;
let useRedis = false;

export async function initStorage() {
  if (initialized) return;
  
  useRedis = await initRedis();
  
  if (useRedis) {
    console.log('✅ Storage: Using Redis');
  } else {
    console.log('⚠️  Storage: Using in-memory fallback');
  }
  
  initialized = true;
}

export async function get(key) {
  if (useRedis && isRedisAvailable()) {
    const value = await getRedis(key);
    if (value !== null) return value;
  }
  return getMemory(key);
}

export async function set(key, value, ttl = null) {
  if (useRedis && isRedisAvailable()) {
    await setRedis(key, value, ttl);
  }
  setMemory(key, value, ttl);
  return true;
}

export async function del(key) {
  if (useRedis && isRedisAvailable()) {
    await delRedis(key);
  }
  delMemory(key);
  return true;
}

// User data helpers
export async function getUserData(userId) {
  return await get(`user:${userId}`) || {
    // Existing fields (keep as-is)
    id: userId,
    region: null,
    queue: null,
    notifyTo: null, // 'bot' or 'channel'
    channelId: null,
    channelName: null,
    ipAddress: null,
    notificationsEnabled: true,
    wizardCompleted: false,
    lastBotMessageId: null,
    
    // NEW fields as per spec
    username: null,
    is_active: true,
    channel_id: null,
    channel_title: null,           // Full title with prefix
    channel_description: null,     // Full description
    channel_photo_file_id: null,   // Telegram file_id of set photo
    channel_user_title: null,      // User's part of title only
    channel_user_description: null, // Optional user description
    channel_status: null,          // 'active' or 'blocked'
    channel_paused: false,         // Channel temporarily paused by user
    channel_branding_updated_at: null, // Timestamp of last branding change
    migration_notified: false,
    router_ip: null,               // Router IP for power monitoring
    power_state: null,             // 'on', 'off', or null
    power_changed_at: null,        // Timestamp of last power state change
    power_notify_target: 'bot',    // 'bot', 'channel', or 'both'
    schedule_hash: null,           // Hash of last sent schedule
    schedule_caption: null,        // Custom caption template
    schedule_periods_format: null, // Custom periods format
    schedule_delete_previous: false, // Delete previous schedule message
    schedule_pic_only: false,      // Send only picture without text
    power_off_text: null,          // Custom "power off" text
    power_on_text: null,           // Custom "power on" text
    last_start_message_id: null,   // Last /start message ID for editing
    created_at: null,
    updated_at: null,
  };
}

export async function setUserData(userId, data) {
  // Track user ID in the list of all users
  await addUserToList(userId);
  return await set(`user:${userId}`, data);
}

export async function delUserData(userId) {
  return await del(`user:${userId}`);
}

// User list helpers
export async function addUserToList(userId) {
  const userList = await get('user_list') || [];
  // Use Set for O(1) lookup
  const userSet = new Set(userList);
  if (!userSet.has(userId)) {
    userList.push(userId);
    await set('user_list', userList);
  }
}

export async function getAllUserIds() {
  return await get('user_list') || [];
}

// Wizard state
export async function getWizardState(userId) {
  return await get(`wizard:${userId}`) || null;
}

export async function setWizardState(userId, state) {
  return await set(`wizard:${userId}`, state, 3600); // 1 hour TTL
}

export async function delWizardState(userId) {
  return await del(`wizard:${userId}`);
}

// Channel setup state
export async function getChannelSetupState(userId) {
  return await get(`channel_setup:${userId}`) || null;
}

export async function setChannelSetupState(userId, state) {
  return await set(`channel_setup:${userId}`, state, 1800); // 30 minutes TTL
}

export async function delChannelSetupState(userId) {
  return await del(`channel_setup:${userId}`);
}

export async function closeStorage() {
  await closeRedis();
}

// Global settings helpers
export async function getGlobalSetting(key, defaultValue = null) {
  const value = await get(`global:${key}`);
  return value !== null ? value : defaultValue;
}

export async function setGlobalSetting(key, value) {
  return await set(`global:${key}`, value);
}

// Bot pause mode
export async function getBotPaused() {
  return await getGlobalSetting('bot_paused', false);
}

export async function setBotPaused(paused) {
  return await setGlobalSetting('bot_paused', paused);
}

export async function getPauseMessage() {
  return await getGlobalSetting('pause_message', null);
}

export async function setPauseMessage(message) {
  return await setGlobalSetting('pause_message', message);
}

export async function getPauseShowSupport() {
  return await getGlobalSetting('pause_show_support', true);
}

export async function setPauseShowSupport(show) {
  return await setGlobalSetting('pause_show_support', show);
}

// Schedule check interval (in milliseconds)
export async function getScheduleCheckInterval() {
  return await getGlobalSetting('schedule_check_interval', 60000); // Default: 1 minute
}

export async function setScheduleCheckInterval(interval) {
  return await setGlobalSetting('schedule_check_interval', interval);
}

// IP check interval (in milliseconds)
export async function getIpCheckInterval() {
  return await getGlobalSetting('ip_check_interval', 30000); // Default: 30 seconds
}

export async function setIpCheckInterval(interval) {
  return await setGlobalSetting('ip_check_interval', interval);
}

// Debounce minutes
export async function getDebounceMinutes() {
  return await getGlobalSetting('debounce_minutes', 3); // Default: 3 minutes
}

export async function setDebounceMinutes(minutes) {
  return await setGlobalSetting('debounce_minutes', minutes);
}
