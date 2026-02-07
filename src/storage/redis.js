import { createClient } from 'redis';
import { config } from '../config.js';

let redisClient = null;
let isConnected = false;
let retryCount = 0;
const MAX_RETRIES = 3;
let fallbackToMemory = false;

export async function initRedis() {
  if (!config.redisUrl) {
    console.log('📦 Redis URL not provided, skipping Redis initialization');
    return false;
  }

  // If already fallback to memory, don't retry
  if (fallbackToMemory) {
    return false;
  }

  try {
    redisClient = createClient({
      url: config.redisUrl,
      socket: {
        reconnectStrategy: (retries) => {
          retryCount = retries;
          // Stop retrying after MAX_RETRIES attempts
          if (retries >= MAX_RETRIES) {
            console.log(`⚠️  Redis connection failed after ${MAX_RETRIES} attempts`);
            console.log('⚠️  Redis unavailable, using in-memory storage');
            fallbackToMemory = true;
            isConnected = false;
            return false; // Stop reconnecting
          }
          // Wait 1 second between retries
          return 1000;
        },
      },
    });

    redisClient.on('error', (err) => {
      if (!fallbackToMemory) {
        console.error('❌ Redis Client Error:', err.message);
      }
      isConnected = false;
    });

    redisClient.on('connect', () => {
      console.log('✅ Redis connected');
      isConnected = true;
      retryCount = 0;
    });

    redisClient.on('end', () => {
      if (!fallbackToMemory) {
        console.log('⚠️  Redis connection closed');
      }
      isConnected = false;
    });

    await redisClient.connect();
    return true;
  } catch (error) {
    retryCount++;
    if (retryCount >= MAX_RETRIES) {
      console.log(`⚠️  Redis connection failed after ${MAX_RETRIES} attempts`);
      console.log('⚠️  Redis unavailable, using in-memory storage');
      fallbackToMemory = true;
    } else {
      console.error('❌ Failed to connect to Redis:', error.message);
    }
    redisClient = null;
    isConnected = false;
    return false;
  }
}

export async function getRedis(key) {
  if (!isConnected || !redisClient || fallbackToMemory) {
    return null;
  }
  try {
    const value = await redisClient.get(key);
    return value ? JSON.parse(value) : null;
  } catch (error) {
    if (!fallbackToMemory) {
      console.error('❌ Redis GET error:', error.message);
    }
    return null;
  }
}

export async function setRedis(key, value, ttl = null) {
  if (!isConnected || !redisClient || fallbackToMemory) {
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
    if (!fallbackToMemory) {
      console.error('❌ Redis SET error:', error.message);
    }
    return false;
  }
}

export async function delRedis(key) {
  if (!isConnected || !redisClient || fallbackToMemory) {
    return false;
  }
  try {
    await redisClient.del(key);
    return true;
  } catch (error) {
    if (!fallbackToMemory) {
      console.error('❌ Redis DEL error:', error.message);
    }
    return false;
  }
}

export function isRedisAvailable() {
  return isConnected && redisClient !== null && !fallbackToMemory;
}

export async function closeRedis() {
  if (redisClient) {
    try {
      await redisClient.quit();
      console.log('✅ Redis connection closed');
    } catch (error) {
      // Ignore errors during shutdown
    }
    redisClient = null;
    isConnected = false;
  }
}
