/**
 * Centralized state manager for wizard, channel setup, IP setup, etc.
 */

import { get, set, del } from '../storage/index.js';

/**
 * State types
 */
export const StateType = {
  WIZARD: 'wizard',
  CHANNEL_SETUP: 'channel_setup',
  IP_SETUP: 'ip_setup',
  CONVERSATION: 'conversation',
  ADMIN_BROADCAST: 'admin_broadcast',
};

/**
 * Get state for a user
 */
export async function getState(userId, type) {
  const key = `state:${type}:${userId}`;
  return await get(key);
}

/**
 * Set state for a user
 * @param {number} userId - User ID
 * @param {string} type - State type
 * @param {Object} state - State data
 * @param {number} ttl - Time to live in seconds (default: 1 hour)
 */
export async function setState(userId, type, state, ttl = 3600) {
  const key = `state:${type}:${userId}`;
  return await set(key, state, ttl);
}

/**
 * Delete state for a user
 */
export async function delState(userId, type) {
  const key = `state:${type}:${userId}`;
  return await del(key);
}

/**
 * Get wizard state
 */
export async function getWizardState(userId) {
  return await getState(userId, StateType.WIZARD);
}

/**
 * Set wizard state
 */
export async function setWizardState(userId, state) {
  return await setState(userId, StateType.WIZARD, state, 3600); // 1 hour
}

/**
 * Delete wizard state
 */
export async function delWizardState(userId) {
  return await delState(userId, StateType.WIZARD);
}

/**
 * Get channel setup state
 */
export async function getChannelSetupState(userId) {
  return await getState(userId, StateType.CHANNEL_SETUP);
}

/**
 * Set channel setup state
 */
export async function setChannelSetupState(userId, state) {
  return await setState(userId, StateType.CHANNEL_SETUP, state, 1800); // 30 minutes
}

/**
 * Delete channel setup state
 */
export async function delChannelSetupState(userId) {
  return await delState(userId, StateType.CHANNEL_SETUP);
}

/**
 * Get IP setup state
 */
export async function getIpSetupState(userId) {
  return await getState(userId, StateType.IP_SETUP);
}

/**
 * Set IP setup state
 */
export async function setIpSetupState(userId, state) {
  return await setState(userId, StateType.IP_SETUP, state, 1800); // 30 minutes
}

/**
 * Delete IP setup state
 */
export async function delIpSetupState(userId) {
  return await delState(userId, StateType.IP_SETUP);
}

/**
 * Get conversation state (for text input)
 */
export async function getConversationState(userId) {
  return await getState(userId, StateType.CONVERSATION);
}

/**
 * Set conversation state
 */
export async function setConversationState(userId, state) {
  return await setState(userId, StateType.CONVERSATION, state, 1800); // 30 minutes
}

/**
 * Delete conversation state
 */
export async function delConversationState(userId) {
  return await delState(userId, StateType.CONVERSATION);
}

/**
 * Get admin broadcast state
 */
export async function getAdminBroadcastState(userId) {
  return await getState(userId, StateType.ADMIN_BROADCAST);
}

/**
 * Set admin broadcast state
 */
export async function setAdminBroadcastState(userId, state) {
  return await setState(userId, StateType.ADMIN_BROADCAST, state, 1800); // 30 minutes
}

/**
 * Delete admin broadcast state
 */
export async function delAdminBroadcastState(userId) {
  return await delState(userId, StateType.ADMIN_BROADCAST);
}

/**
 * Clear all states for a user
 */
export async function clearAllStates(userId) {
  await Promise.all([
    delWizardState(userId),
    delChannelSetupState(userId),
    delIpSetupState(userId),
    delConversationState(userId),
    delAdminBroadcastState(userId),
  ]);
}

/**
 * Check if user is in any active state
 */
export async function hasActiveState(userId) {
  const states = await Promise.all([
    getWizardState(userId),
    getChannelSetupState(userId),
    getIpSetupState(userId),
    getConversationState(userId),
    getAdminBroadcastState(userId),
  ]);
  
  return states.some(state => state !== null);
}
