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
    // Channel branding fields
    channel_id: null,
    channel_title: null,
    channel_description: null,
    channel_photo_file_id: null,
    channel_user_title: null,
    channel_user_description: null,
    channel_status: null, // 'active' or 'blocked'
    channel_branding_updated_at: null,
    migration_notified: false,
  };
}

export async function setUserData(userId, data) {
  // Track user ID in the list of all users
  await addUserToList(userId);
  return await set(`user:${userId}`, data);
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
