import { createClient } from 'redis';
import { config } from '../config.js';

let redisClient = null;
let isConnected = false;

export async function initRedis() {
  if (!config.redisUrl) {
    console.log('📦 Redis URL not provided, skipping Redis initialization');
    return false;
  }

  try {
    redisClient = createClient({
      url: config.redisUrl,
    });

    redisClient.on('error', (err) => {
      console.error('❌ Redis Client Error:', err);
      isConnected = false;
    });

    redisClient.on('connect', () => {
      console.log('✅ Redis connected');
      isConnected = true;
    });

    await redisClient.connect();
    return true;
  } catch (error) {
    console.error('❌ Failed to connect to Redis:', error.message);
    redisClient = null;
    isConnected = false;
    return false;
  }
}

export async function getRedis(key) {
  if (!isConnected || !redisClient) {
    return null;
  }
  try {
    const value = await redisClient.get(key);
    return value ? JSON.parse(value) : null;
  } catch (error) {
    console.error('❌ Redis GET error:', error.message);
    return null;
  }
}

export async function setRedis(key, value, ttl = null) {
  if (!isConnected || !redisClient) {
    return false;
  }
  try {
    const stringValue = JSON.stringify(value);
    if (ttl) {
      await redisClient.setEx(key, ttl, stringValue);
    } else {
      await redisClient.set(key, stringValue);
    }
    return true;
  } catch (error) {
    console.error('❌ Redis SET error:', error.message);
    return false;
  }
}

export async function delRedis(key) {
  if (!isConnected || !redisClient) {
    return false;
  }
  try {
    await redisClient.del(key);
    return true;
  } catch (error) {
    console.error('❌ Redis DEL error:', error.message);
    return false;
  }
}

export function isRedisAvailable() {
  return isConnected && redisClient !== null;
}
