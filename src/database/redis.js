const Redis = require('ioredis');

let client = null;

function getRedisClient() {
  if (!client) {
    client = new Redis({
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379', 10),
      password: process.env.REDIS_PASSWORD || undefined,
      db: parseInt(process.env.REDIS_DB || '0', 10),
      maxRetriesPerRequest: 3,
      retryStrategy(times) {
        const delay = Math.min(times * 200, 5000);
        return delay;
      },
      lazyConnect: true,
      enableReadyCheck: true,
      connectTimeout: 10000,
      commandTimeout: 5000,
    });

    client.on('connect', () => console.log('✅ Redis підключено'));
    client.on('error', (err) => console.error('❌ Redis помилка:', err.message));
    client.on('reconnecting', () => console.log('🔄 Redis перепідключення...'));
  }
  return client;
}

// === USER OPERATIONS ===

async function getUser(chatId) {
  try {
    const data = await client.hgetall(`user:${chatId}`);
    if (!data || Object.keys(data).length === 0) {
      return null;
    }
    
    // Convert string values back to appropriate types
    return {
      ...data,
      chatId: parseInt(data.chatId, 10),
      isActive: data.isActive === 'true',
      createdAt: data.createdAt ? parseInt(data.createdAt, 10) : Date.now(),
      updatedAt: data.updatedAt ? parseInt(data.updatedAt, 10) : Date.now(),
    };
  } catch (error) {
    console.error(`Error getting user ${chatId}:`, error);
    return null;
  }
}

async function saveUser(chatId, userData) {
  try {
    const pipeline = client.pipeline();
    
    // Prepare data for storage
    const dataToStore = {
      ...userData,
      chatId: String(chatId),
      isActive: String(userData.isActive !== false),
      updatedAt: String(Date.now()),
      createdAt: userData.createdAt ? String(userData.createdAt) : String(Date.now()),
    };
    
    // Store user hash
    pipeline.hmset(`user:${chatId}`, dataToStore);
    
    // Add to global users set
    pipeline.sadd('users:all', String(chatId));
    
    // Add to region-specific sets if region is specified
    if (userData.region) {
      pipeline.sadd(`users:region:${userData.region}`, String(chatId));
      
      if (userData.queue) {
        pipeline.sadd(`users:region:${userData.region}:queue:${userData.queue}`, String(chatId));
      }
    }
    
    await pipeline.exec();
    return true;
  } catch (error) {
    console.error(`Error saving user ${chatId}:`, error);
    return false;
  }
}

async function updateUser(chatId, fields) {
  try {
    const fieldsToStore = {
      ...fields,
      updatedAt: String(Date.now()),
    };
    
    // Convert boolean to string if present
    if ('isActive' in fieldsToStore) {
      fieldsToStore.isActive = String(fieldsToStore.isActive);
    }
    
    await client.hmset(`user:${chatId}`, fieldsToStore);
    
    // Update region sets if region or queue changed
    if (fields.region || fields.queue) {
      const user = await getUser(chatId);
      if (user) {
        const pipeline = client.pipeline();
        
        if (fields.region) {
          pipeline.sadd(`users:region:${fields.region}`, String(chatId));
        }
        
        if (fields.queue && user.region) {
          pipeline.sadd(`users:region:${user.region}:queue:${fields.queue}`, String(chatId));
        }
        
        await pipeline.exec();
      }
    }
    
    return true;
  } catch (error) {
    console.error(`Error updating user ${chatId}:`, error);
    return false;
  }
}

async function deleteUser(chatId) {
  try {
    const user = await getUser(chatId);
    const pipeline = client.pipeline();
    
    // Delete user data
    pipeline.del(`user:${chatId}`);
    pipeline.del(`user:${chatId}:settings`);
    pipeline.del(`user:${chatId}:ip`);
    pipeline.del(`user:${chatId}:channels`);
    
    // Remove from sets
    pipeline.srem('users:all', String(chatId));
    
    if (user && user.region) {
      pipeline.srem(`users:region:${user.region}`, String(chatId));
      
      if (user.queue) {
        pipeline.srem(`users:region:${user.region}:queue:${user.queue}`, String(chatId));
      }
    }
    
    // Remove from IP monitoring
    pipeline.srem('ip:monitoring:active', String(chatId));
    
    await pipeline.exec();
    return true;
  } catch (error) {
    console.error(`Error deleting user ${chatId}:`, error);
    return false;
  }
}

async function getUserCount() {
  try {
    return await client.scard('users:all');
  } catch (error) {
    console.error('Error getting user count:', error);
    return 0;
  }
}

async function getAllUserIds() {
  try {
    const members = await client.smembers('users:all');
    return members.map(id => parseInt(id, 10));
  } catch (error) {
    console.error('Error getting all user IDs:', error);
    return [];
  }
}

async function getUsersByRegion(region) {
  try {
    const members = await client.smembers(`users:region:${region}`);
    return members.map(id => parseInt(id, 10));
  } catch (error) {
    console.error(`Error getting users by region ${region}:`, error);
    return [];
  }
}

async function getUsersByRegionAndQueue(region, queue) {
  try {
    const members = await client.smembers(`users:region:${region}:queue:${queue}`);
    return members.map(id => parseInt(id, 10));
  } catch (error) {
    console.error(`Error getting users by region ${region} and queue ${queue}:`, error);
    return [];
  }
}

async function getUserByChannelId(channelId) {
  try {
    const channelData = await client.hgetall(`channel:${channelId}`);
    if (!channelData || !channelData.chatId) {
      return null;
    }
    return await getUser(parseInt(channelData.chatId, 10));
  } catch (error) {
    console.error(`Error getting user by channel ${channelId}:`, error);
    return null;
  }
}

// === STATE OPERATIONS (with TTL!) ===

async function saveState(type, chatId, data, ttlSeconds = 86400) {
  try {
    const key = `state:${type}:${chatId}`;
    const pipeline = client.pipeline();
    
    // Convert data to string format for hash
    const dataToStore = {};
    for (const [k, v] of Object.entries(data)) {
      dataToStore[k] = typeof v === 'object' ? JSON.stringify(v) : String(v);
    }
    
    pipeline.hmset(key, dataToStore);
    pipeline.expire(key, ttlSeconds);
    
    await pipeline.exec();
    return true;
  } catch (error) {
    console.error(`Error saving state ${type} for ${chatId}:`, error);
    return false;
  }
}

async function getState(type, chatId) {
  try {
    const key = `state:${type}:${chatId}`;
    const data = await client.hgetall(key);
    
    if (!data || Object.keys(data).length === 0) {
      return null;
    }
    
    // Parse JSON strings back to objects
    const parsedData = {};
    for (const [k, v] of Object.entries(data)) {
      try {
        parsedData[k] = JSON.parse(v);
      } catch {
        parsedData[k] = v;
      }
    }
    
    return parsedData;
  } catch (error) {
    console.error(`Error getting state ${type} for ${chatId}:`, error);
    return null;
  }
}

async function deleteState(type, chatId) {
  try {
    const key = `state:${type}:${chatId}`;
    await client.del(key);
    return true;
  } catch (error) {
    console.error(`Error deleting state ${type} for ${chatId}:`, error);
    return false;
  }
}

async function hasState(type, chatId) {
  try {
    const key = `state:${type}:${chatId}`;
    const exists = await client.exists(key);
    return exists === 1;
  } catch (error) {
    console.error(`Error checking state ${type} for ${chatId}:`, error);
    return false;
  }
}

// === SETTINGS ===

async function getSetting(key, defaultValue = null) {
  try {
    const value = await client.get(`settings:${key}`);
    return value !== null ? value : defaultValue;
  } catch (error) {
    console.error(`Error getting setting ${key}:`, error);
    return defaultValue;
  }
}

async function setSetting(key, value) {
  try {
    await client.set(`settings:${key}`, String(value));
    return true;
  } catch (error) {
    console.error(`Error setting ${key}:`, error);
    return false;
  }
}

// === CHANNEL OPERATIONS ===

async function saveChannel(channelId, data) {
  try {
    const pipeline = client.pipeline();
    
    const dataToStore = {
      ...data,
      channelId: String(channelId),
      chatId: String(data.chatId),
      status: data.status || 'active',
      updatedAt: String(Date.now()),
      createdAt: data.createdAt ? String(data.createdAt) : String(Date.now()),
    };
    
    pipeline.hmset(`channel:${channelId}`, dataToStore);
    pipeline.sadd('channels:all', String(channelId));
    
    if (data.chatId) {
      pipeline.sadd(`user:${data.chatId}:channels`, String(channelId));
    }
    
    await pipeline.exec();
    return true;
  } catch (error) {
    console.error(`Error saving channel ${channelId}:`, error);
    return false;
  }
}

async function getChannel(channelId) {
  try {
    const data = await client.hgetall(`channel:${channelId}`);
    if (!data || Object.keys(data).length === 0) {
      return null;
    }
    
    return {
      ...data,
      channelId: parseInt(data.channelId, 10),
      chatId: parseInt(data.chatId, 10),
      createdAt: data.createdAt ? parseInt(data.createdAt, 10) : Date.now(),
      updatedAt: data.updatedAt ? parseInt(data.updatedAt, 10) : Date.now(),
    };
  } catch (error) {
    console.error(`Error getting channel ${channelId}:`, error);
    return null;
  }
}

async function deleteChannel(channelId) {
  try {
    const channel = await getChannel(channelId);
    const pipeline = client.pipeline();
    
    pipeline.del(`channel:${channelId}`);
    pipeline.srem('channels:all', String(channelId));
    
    if (channel && channel.chatId) {
      pipeline.srem(`user:${channel.chatId}:channels`, String(channelId));
    }
    
    await pipeline.exec();
    return true;
  } catch (error) {
    console.error(`Error deleting channel ${channelId}:`, error);
    return false;
  }
}

async function getAllChannelIds() {
  try {
    const members = await client.smembers('channels:all');
    return members.map(id => parseInt(id, 10));
  } catch (error) {
    console.error('Error getting all channel IDs:', error);
    return [];
  }
}

// === CACHE ===

async function setCache(key, value, ttlSeconds = 300) {
  try {
    const fullKey = `cache:${key}`;
    await client.setex(fullKey, ttlSeconds, JSON.stringify(value));
    return true;
  } catch (error) {
    console.error(`Error setting cache ${key}:`, error);
    return false;
  }
}

async function getCache(key) {
  try {
    const fullKey = `cache:${key}`;
    const value = await client.get(fullKey);
    return value ? JSON.parse(value) : null;
  } catch (error) {
    console.error(`Error getting cache ${key}:`, error);
    return null;
  }
}

// === RATE LIMITING ===

async function incrementRateLimit(key, ttlSeconds = 60) {
  try {
    const fullKey = `capacity:${key}`;
    const pipeline = client.pipeline();
    
    pipeline.incr(fullKey);
    pipeline.expire(fullKey, ttlSeconds);
    
    const results = await pipeline.exec();
    return results[0][1]; // Return the incremented value
  } catch (error) {
    console.error(`Error incrementing rate limit ${key}:`, error);
    return 0;
  }
}

async function getRateLimit(key) {
  try {
    const fullKey = `capacity:${key}`;
    const value = await client.get(fullKey);
    return value ? parseInt(value, 10) : 0;
  } catch (error) {
    console.error(`Error getting rate limit ${key}:`, error);
    return 0;
  }
}

// === STATISTICS ===

async function incrementStat(field, count = 1) {
  try {
    const today = new Date().toISOString().split('T')[0];
    await client.hincrby(`stats:daily:${today}`, field, count);
    return true;
  } catch (error) {
    console.error(`Error incrementing stat ${field}:`, error);
    return false;
  }
}

async function getStats() {
  try {
    const data = await client.hgetall('stats:total');
    if (!data || Object.keys(data).length === 0) {
      return {};
    }
    
    // Convert string values to numbers
    const stats = {};
    for (const [key, value] of Object.entries(data)) {
      stats[key] = parseInt(value, 10) || 0;
    }
    
    return stats;
  } catch (error) {
    console.error('Error getting stats:', error);
    return {};
  }
}

async function getDailyStats(date) {
  try {
    const data = await client.hgetall(`stats:daily:${date}`);
    if (!data || Object.keys(data).length === 0) {
      return {};
    }
    
    // Convert string values to numbers
    const stats = {};
    for (const [key, value] of Object.entries(data)) {
      stats[key] = parseInt(value, 10) || 0;
    }
    
    return stats;
  } catch (error) {
    console.error(`Error getting daily stats for ${date}:`, error);
    return {};
  }
}

// === GRACEFUL SHUTDOWN ===

async function closeRedis() {
  if (client) {
    try {
      await client.quit();
      console.log('✅ Redis з\'єднання закрито');
    } catch (error) {
      console.error('Error closing Redis:', error);
    }
    client = null;
  }
}

module.exports = {
  getRedisClient,
  getUser,
  saveUser,
  updateUser,
  deleteUser,
  getUserCount,
  getAllUserIds,
  getUsersByRegion,
  getUsersByRegionAndQueue,
  getUserByChannelId,
  saveState,
  getState,
  deleteState,
  hasState,
  getSetting,
  setSetting,
  saveChannel,
  getChannel,
  deleteChannel,
  getAllChannelIds,
  setCache,
  getCache,
  incrementRateLimit,
  getRateLimit,
  incrementStat,
  getStats,
  getDailyStats,
  closeRedis,
};
