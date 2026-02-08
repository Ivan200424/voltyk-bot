const { saveState, getState: redisGetState, deleteState: redisDeleteState, hasState: redisHasState } = require('../database/redis');

// State types and their TTLs
const STATE_TTLS = {
  wizard: 86400,        // 24 hours
  conversation: 86400,  // 24 hours
  ip_setup: 3600,       // 1 hour
  pending_channel: 1800, // 30 minutes
  lastMenuMessages: 86400,
  channel_setup: 3600,  // 1 hour
};

async function setState(type, chatId, data) {
  const ttl = STATE_TTLS[type] || 86400;
  await saveState(type, chatId, data, ttl);
}

async function getState(type, chatId) {
  return await redisGetState(type, chatId);
}

async function clearState(type, chatId) {
  await redisDeleteState(type, chatId);
}

async function hasState(type, chatId) {
  return await redisHasState(type, chatId);
}

module.exports = { setState, getState, clearState, hasState, STATE_TTLS };
